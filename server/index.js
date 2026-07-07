import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import cors from "cors";
import dotenv from "dotenv";
import { toNodeHandler, fromNodeHeaders } from "better-auth/node";
import { auth, prisma } from "./auth.js";

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3001;

// CORS — allow all origins in development (file:// origin is "null")
app.use(cors({
  origin: process.env.NODE_ENV === "production"
    ? (process.env.CORS_ORIGIN || "http://localhost:3000")
    : true,
  credentials: true,
}));

// Better Auth handler — must come BEFORE express.json()
app.all("/api/auth/*", toNodeHandler(auth));

// Body parsing for non-auth routes
app.use(express.json({ limit: "10kb" }));

// Get current session
app.get("/api/me", async (req, res) => {
  const session = await auth.api.getSession({
    headers: fromNodeHeaders(req.headers),
  });
  res.json(session);
});

// Health check
app.get("/api/health", (req, res) => {
  res.json({ status: "Server is running", time: new Date() });
});

// =====================================================================
// HELPERS
// =====================================================================
function slugify(text) {
  return text
    .toString().toLowerCase().trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w-]+/g, '')
    .replace(/--+/g, '-')
    .replace(/^-+/, '')
    .replace(/-+$/, '');
}

function parseAmount(val) {
  if (!val) return null;
  const cleaned = val.replace(/[₹$,\s]/g, '');
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}

function formatCurrency(val) {
  if (val == null) return null;
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(Number(val));
}

function daysBetween(d1, d2) {
  const a = new Date(d1);
  const b = new Date(d2 || new Date());
  return Math.floor((b - a) / (1000 * 60 * 60 * 24));
}

function randomId() {
  return Math.random().toString(36).substring(2, 8);
}

// =====================================================================
// REGISTER PROFILE — creates UserRole + role-specific records
// =====================================================================
app.post("/api/register-profile", async (req, res) => {
  try {
    const session = await auth.api.getSession({
      headers: fromNodeHeaders(req.headers),
    });
    if (!session) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const userId = session.user.id;
    const { role, ...data } = req.body;
    const validatedRole = ["franchisor", "franchisee"].includes(role) ? role : null;
    if (!validatedRole) {
      return res.status(400).json({ error: "Invalid or missing role" });
    }

    await prisma.$transaction(async (tx) => {
      const existingRole = await tx.userRole.findUnique({
        where: { userId_role: { userId, role: validatedRole } },
      });
      if (!existingRole) {
        await tx.userRole.create({
          data: { userId, role: validatedRole, isPrimary: true },
        });
      }

      if (validatedRole === "franchisor") {
        const orgName = data.companyName || `${session.user.firstName} ${session.user.lastName}'s Company`;
        const orgSlug = slugify(orgName) + '-' + userId.slice(-6);
        const org = await tx.organization.create({
          data: {
            name: orgName,
            orgType: "franchisor",
            slug: orgSlug,
            website: data.website || null,
            employeeCount: data.companySize || null,
            createdById: userId,
          },
        });
        await tx.organizationMember.create({
          data: {
            organizationId: org.id,
            userId,
            title: data.title || "Owner",
            memberRole: "owner",
            isPrimaryContact: true,
          },
        });
      }

      if (validatedRole === "franchisee") {
        const existingProfile = await tx.franchiseeProfile.findUnique({
          where: { userId },
        });
        if (!existingProfile) {
          await tx.franchiseeProfile.create({
            data: {
              userId,
              investmentCapacityMin: parseAmount(data.investmentMin),
              investmentCapacityMax: parseAmount(data.investmentMax),
              liquidCapital: parseAmount(data.liquidCapital),
              netWorth: parseAmount(data.netWorth),
              timeline: data.timeline || null,
            },
          });
        }

        if (data.industries) {
          const names = data.industries.split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
          for (const name of names) {
            const indSlug = slugify(name);
            let industry = await tx.industry.findUnique({ where: { slug: indSlug } });
            if (!industry) {
              industry = await tx.industry.create({ data: { name, slug: indSlug } });
            }
            await tx.franchiseeIndustryInterest.create({
              data: { franchiseeUserId: userId, industryId: industry.id },
            }).catch(() => { });
          }
        }

        if (data.locations) {
          const locs = data.locations.split(';').map(s => s.trim()).filter(Boolean);
          for (const loc of locs) {
            const parts = loc.split(',').map(s => s.trim());
            await tx.franchiseeLocationInterest.create({
              data: {
                franchiseeUserId: userId,
                city: parts[0] || null,
                stateProvince: parts[1] || null,
                countryCode: parts[2] ? parts[2].substring(0, 2).toUpperCase() : null,
              },
            });
          }
        }
      }
    });

    res.json({ success: true, role: validatedRole });
  } catch (error) {
    console.error("Profile registration error:", error);
    res.status(500).json({ error: error.message || "Profile creation failed" });
  }
});

// =====================================================================
// DASHBOARD DATA
// =====================================================================
app.get("/api/dashboard", async (req, res) => {
  try {
    const session = await auth.api.getSession({
      headers: fromNodeHeaders(req.headers),
    });
    if (!session) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const userId = session.user.id;

    const userRole = await prisma.userRole.findFirst({
      where: { userId, isPrimary: true },
    });
    if (!userRole) {
      return res.status(400).json({ error: "No role assigned. Please complete registration." });
    }

    const role = userRole.role;
    let profile = {};

    if (role === "franchisor") {
      const org = await prisma.organization.findFirst({
        where: { createdById: userId },
        include: {
          franchiseBrands: {
            include: {
              listings: true,
              _count: { select: { listings: true, documents: true } },
            },
          },
          members: true,
        },
      });

      const brandIds = org?.franchiseBrands.map(b => b.id) || [];
      const listingIds = org?.franchiseBrands.flatMap(b => b.listings.map(l => l.id)) || [];

      const activeDeals = await prisma.deal.count({
        where: { franchiseListingId: { in: listingIds }, closedStatus: "open" },
      });
      const totalLeads = await prisma.lead.count({
        where: { franchiseListingId: { in: listingIds } },
      });
      const recentDeals = await prisma.deal.findMany({
        where: { franchiseListingId: { in: listingIds } },
        include: { franchiseeUser: { select: { firstName: true, lastName: true } } },
        orderBy: { createdAt: "desc" },
        take: 5,
      });
      const recentLeads = await prisma.lead.findMany({
        where: { franchiseListingId: { in: listingIds } },
        include: {
          franchiseeUser: { select: { firstName: true, lastName: true } },
          franchiseListing: { select: { title: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 5,
      });

      profile = {
        organization: org ? {
          id: org.id,
          name: org.name,
          website: org.website,
          employeeCount: org.employeeCount,
        } : null,
        brands: (org?.franchiseBrands || []).map(b => ({
          id: b.id,
          name: b.name,
          listingCount: b._count.listings,
          status: b.status,
        })),
        stats: {
          brands: org?.franchiseBrands.length || 0,
          activeListings: listingIds.length,
          activeDeals,
          totalLeads,
        },
        recentDeals,
        recentLeads,
      };
    }

    if (role === "franchisee") {
      const franchiseeProfile = await prisma.franchiseeProfile.findUnique({
        where: { userId },
        include: {
          industryInterests: { include: { industry: true } },
          locationInterests: true,
        },
      });

      const leadsCount = await prisma.lead.count({ where: { franchiseeUserId: userId } });
      const dealsCount = await prisma.deal.count({ where: { franchiseeUserId: userId } });
      const recentLeads = await prisma.lead.findMany({
        where: { franchiseeUserId: userId },
        include: {
          franchiseListing: { select: { title: true, franchiseBrand: { select: { name: true } } } },
        },
        orderBy: { createdAt: "desc" },
        take: 5,
      });

      const industryIds = franchiseeProfile?.industryInterests.map(i => i.industryId) || [];
      const recommendedListings = await prisma.franchiseListing.findMany({
        where: {
          status: "active",
          franchiseBrand: industryIds.length > 0
            ? { industryId: { in: industryIds } }
            : undefined,
        },
        include: {
          franchiseBrand: { select: { name: true, logoUrl: true, industry: { select: { name: true } } } },
          territory: { select: { city: true, stateProvince: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 6,
      });

      profile = {
        profile: franchiseeProfile ? {
          investmentCapacityMin: franchiseeProfile.investmentCapacityMin?.toString(),
          investmentCapacityMax: franchiseeProfile.investmentCapacityMax?.toString(),
          liquidCapital: franchiseeProfile.liquidCapital?.toString(),
          netWorth: franchiseeProfile.netWorth?.toString(),
          timeline: franchiseeProfile.timeline,
        } : null,
        interests: {
          industries: franchiseeProfile?.industryInterests.map(i => i.industry.name) || [],
          locations: franchiseeProfile?.locationInterests.map(l => [l.city, l.stateProvince].filter(Boolean).join(', ')) || [],
        },
        stats: {
          activeLeads: leadsCount,
          deals: dealsCount,
          interests: (franchiseeProfile?.industryInterests.length || 0) + (franchiseeProfile?.locationInterests.length || 0),
        },
        recentLeads,
        recommendedListings,
      };
    }

    res.json({
      user: {
        id: userId,
        firstName: session.user.firstName,
        lastName: session.user.lastName,
        email: session.user.email,
        avatarUrl: session.user.avatarUrl,
      },
      role,
      profile,
    });
  } catch (error) {
    console.error("Dashboard error:", error);
    res.status(500).json({ error: error.message || "Failed to load dashboard" });
  }
});

// =====================================================================
// C1 — SEARCH LISTINGS
// =====================================================================
app.get("/api/listings/search", async (req, res) => {
  try {
    const session = await auth.api.getSession({
      headers: fromNodeHeaders(req.headers),
    });
    if (!session) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const { q, industry, min_investment, max_investment, location, veteran, sort, page, limit } = req.query;
    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.min(50, Math.max(1, parseInt(limit) || 12));
    const skip = (pageNum - 1) * limitNum;

    const where = { status: "active" };

    if (q) {
      where.OR = [
        { title: { contains: q, mode: "insensitive" } },
        { franchiseBrand: { name: { contains: q, mode: "insensitive" } } },
      ];
    }
    if (industry) {
      where.franchiseBrand = { ...(where.franchiseBrand || {}), industry: { slug: industry } };
    }
    if (min_investment) {
      where.investmentMin = { gte: parseFloat(min_investment) };
    }
    if (max_investment) {
      where.investmentMax = { lte: parseFloat(max_investment) };
    }
    if (veteran === "true") {
      where.franchiseBrand = { ...(where.franchiseBrand || {}), veteranDiscount: true };
    }
    if (location) {
      where.territory = {
        OR: [
          { city: { contains: location, mode: "insensitive" } },
          { stateProvince: { contains: location, mode: "insensitive" } },
        ],
      };
    }

    const orderBy = {};
    switch (sort) {
      case "investment_low": orderBy.investmentMin = "asc"; break;
      case "investment_high": orderBy.investmentMin = "desc"; break;
      case "most_units": orderBy.franchiseBrand = { totalUnits: "desc" }; break;
      default: orderBy.listedAt = "desc";
    }

    const [listings, total] = await Promise.all([
      prisma.franchiseListing.findMany({
        where,
        include: {
          franchiseBrand: { select: { id: true, name: true, logoUrl: true, industry: { select: { id: true, name: true, slug: true } } } },
          territory: { select: { id: true, city: true, stateProvince: true, countryCode: true } },
        },
        orderBy,
        skip,
        take: limitNum,
      }),
      prisma.franchiseListing.count({ where }),
    ]);

    res.json({
      listings,
      total,
      page: pageNum,
      totalPages: Math.ceil(total / limitNum),
    });
  } catch (error) {
    console.error("Search listings error:", error);
    res.status(500).json({ error: error.message || "Search failed" });
  }
});

// =====================================================================
// C2 — LISTING / BRAND DETAIL
// =====================================================================
app.get("/api/listings/:id", async (req, res) => {
  try {
    const session = await auth.api.getSession({
      headers: fromNodeHeaders(req.headers),
    });
    if (!session) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const listing = await prisma.franchiseListing.findUnique({
      where: { id: req.params.id },
      include: {
        franchiseBrand: {
          select: {
            id: true, name: true, logoUrl: true, coverImageUrl: true, description: true,
            industry: { select: { id: true, name: true, slug: true } },
            foundedYear: true, totalUnits: true, franchiseFee: true, royaltyFeePct: true,
            marketingFeePct: true, netWorthRequirement: true, liquidCapitalRequirement: true,
            veteranDiscount: true, status: true,
          },
        },
        territory: true,
      },
    });

    if (!listing) {
      return res.status(404).json({ error: "Listing not found" });
    }

    const documents = await prisma.document.findMany({
      where: {
        franchiseBrandId: listing.franchiseBrandId,
        documentType: "marketing_kit",
      },
    });

    const reviews = await prisma.review.findMany({
      where: { status: "published" },
      include: { user: { select: { firstName: true, lastName: true, avatarUrl: true } } },
      orderBy: { createdAt: "desc" },
    });

    let averageRating = null;
    if (reviews.length > 0) {
      const sum = reviews.reduce((acc, r) => acc + r.rating, 0);
      averageRating = Math.round((sum / reviews.length) * 10) / 10;
    }

    res.json({ listing, brand: listing.franchiseBrand, territories: listing.territory ? [listing.territory] : [], documents, reviews, averageRating });
  } catch (error) {
    console.error("Listing detail error:", error);
    res.status(500).json({ error: error.message || "Failed to load listing" });
  }
});

// =====================================================================
// C3 — REQUEST INFORMATION (create lead)
// =====================================================================
app.post("/api/leads", async (req, res) => {
  try {
    const session = await auth.api.getSession({
      headers: fromNodeHeaders(req.headers),
    });
    if (!session) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const userId = session.user.id;
    const { listingId, notes } = req.body;

    if (!listingId) {
      return res.status(400).json({ error: "listingId is required" });
    }

    const existing = await prisma.lead.findUnique({
      where: { franchiseListingId_franchiseeUserId: { franchiseListingId: listingId, franchiseeUserId: userId } },
    });
    if (existing) {
      return res.status(409).json({ error: "Lead already exists for this listing" });
    }

    const result = await prisma.$transaction(async (tx) => {
      const lead = await tx.lead.create({
        data: {
          franchiseListingId: listingId,
          franchiseeUserId: userId,
          source: "direct",
          status: "new",
          notes: notes || null,
        },
      });

      const deal = await tx.deal.create({
        data: {
          leadId: lead.id,
          franchiseListingId: listingId,
          franchiseeUserId: userId,
          stage: "inquiry",
        },
      });

      return { lead, deal };
    });

    res.status(201).json({ success: true, ...result });
  } catch (error) {
    console.error("Create lead error:", error);
    res.status(500).json({ error: error.message || "Failed to create lead" });
  }
});

// =====================================================================
// C4 — SAVED LISTINGS
// =====================================================================
app.get("/api/saved", async (req, res) => {
  try {
    const session = await auth.api.getSession({
      headers: fromNodeHeaders(req.headers),
    });
    if (!session) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const userId = session.user.id;

    const saved = await prisma.savedListing.findMany({
      where: { userId },
      include: {
        listing: {
          include: {
            franchiseBrand: { select: { id: true, name: true, logoUrl: true, industry: { select: { name: true, slug: true } } } },
            territory: { select: { id: true, city: true, stateProvince: true, countryCode: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    res.json({ saved });
  } catch (error) {
    console.error("Get saved error:", error);
    res.status(500).json({ error: error.message || "Failed to get saved listings" });
  }
});

app.post("/api/saved", async (req, res) => {
  try {
    const session = await auth.api.getSession({
      headers: fromNodeHeaders(req.headers),
    });
    if (!session) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const userId = session.user.id;
    const { listingId } = req.body;

    if (!listingId) {
      return res.status(400).json({ error: "listingId is required" });
    }

    const existing = await prisma.savedListing.findUnique({
      where: { userId_listingId: { userId, listingId } },
    });

    if (existing) {
      await prisma.savedListing.delete({ where: { id: existing.id } });
      return res.json({ saved: false });
    }

    await prisma.savedListing.create({
      data: { userId, listingId },
    });

    res.json({ saved: true });
  } catch (error) {
    console.error("Toggle saved error:", error);
    res.status(500).json({ error: error.message || "Failed to toggle saved listing" });
  }
});

// =====================================================================
// C5 — PIPELINE (leads + deals for current user)
// =====================================================================
app.get("/api/pipeline", async (req, res) => {
  try {
    const session = await auth.api.getSession({
      headers: fromNodeHeaders(req.headers),
    });
    if (!session) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const userId = session.user.id;

    const userRole = await prisma.userRole.findFirst({
      where: { userId, isPrimary: true },
    });

    let leads, deals;

    if (userRole?.role === "franchisee") {
      leads = await prisma.lead.findMany({
        where: { franchiseeUserId: userId },
        include: {
          franchiseListing: {
            include: {
              franchiseBrand: { select: { id: true, name: true, logoUrl: true } },
            },
          },
        },
        orderBy: { createdAt: "desc" },
      });

      deals = await prisma.deal.findMany({
        where: { franchiseeUserId: userId },
        include: {
          franchiseListing: {
            include: {
              franchiseBrand: { select: { id: true, name: true, logoUrl: true } },
            },
          },
          stageHistory: { orderBy: { changedAt: "desc" }, take: 1 },
        },
        orderBy: { createdAt: "desc" },
      });
    } else {
      const org = await prisma.organization.findFirst({
        where: { createdById: userId },
        select: { id: true },
      });

      const listingIds = org
        ? (await prisma.franchiseListing.findMany({ where: { franchiseBrand: { organizationId: org.id } }, select: { id: true } })).map(l => l.id)
        : [];

      leads = await prisma.lead.findMany({
        where: { franchiseListingId: { in: listingIds } },
        include: {
          franchiseListing: {
            include: {
              franchiseBrand: { select: { id: true, name: true, logoUrl: true } },
            },
          },
          franchiseeUser: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
        },
        orderBy: { createdAt: "desc" },
      });

      deals = await prisma.deal.findMany({
        where: { franchiseListingId: { in: listingIds } },
        include: {
          franchiseListing: {
            include: {
              franchiseBrand: { select: { id: true, name: true, logoUrl: true } },
            },
          },
          franchiseeUser: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
          stageHistory: { orderBy: { changedAt: "desc" }, take: 1 },
        },
        orderBy: { createdAt: "desc" },
      });
    }

    const enrichedDeals = deals.map(d => ({
      ...d,
      daysInStage: d.stageHistory.length > 0 ? daysBetween(d.stageHistory[0].changedAt, new Date()) : daysBetween(d.createdAt, new Date()),
    }));

    res.json({ leads, deals: enrichedDeals });
  } catch (error) {
    console.error("Pipeline error:", error);
    res.status(500).json({ error: error.message || "Failed to load pipeline" });
  }
});

// =====================================================================
// C6 — BRANDS CRUD (Franchisor)
// =====================================================================
app.get("/api/brands", async (req, res) => {
  try {
    const session = await auth.api.getSession({
      headers: fromNodeHeaders(req.headers),
    });
    if (!session) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const userId = session.user.id;

    const org = await prisma.organization.findFirst({
      where: { createdById: userId },
    });
    if (!org) {
      return res.status(404).json({ error: "No organization found" });
    }

    const brands = await prisma.franchiseBrand.findMany({
      where: { organizationId: org.id },
      include: {
        _count: { select: { listings: true } },
        territories: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    const brandIds = brands.map(b => b.id);

    const dealsByBrand = await prisma.deal.groupBy({
      by: ["franchiseListingId"],
      where: {
        franchiseListing: { franchiseBrandId: { in: brandIds } },
        closedStatus: "open",
      },
      _count: true,
    });

    const listingBrandMap = {};
    const listings = await prisma.franchiseListing.findMany({
      where: { franchiseBrandId: { in: brandIds } },
      select: { id: true, franchiseBrandId: true },
    });
    for (const l of listings) {
      listingBrandMap[l.id] = l.franchiseBrandId;
    }

    const dealCounts = {};
    for (const d of dealsByBrand) {
      const brandId = listingBrandMap[d.franchiseListingId];
      if (brandId) {
        dealCounts[brandId] = (dealCounts[brandId] || 0) + d._count;
      }
    }

    const result = brands.map(b => ({
      ...b,
      listingCount: b._count.listings,
      activeDealCount: dealCounts[b.id] || 0,
      _count: undefined,
    }));

    res.json({ brands: result });
  } catch (error) {
    console.error("Get brands error:", error);
    res.status(500).json({ error: error.message || "Failed to get brands" });
  }
});

app.post("/api/brands", async (req, res) => {
  try {
    const session = await auth.api.getSession({
      headers: fromNodeHeaders(req.headers),
    });
    if (!session) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const userId = session.user.id;
    const data = req.body;

    let org = await prisma.organization.findFirst({
      where: { createdById: userId },
    });

    if (!org) {
      const orgName = `${session.user.firstName} ${session.user.lastName}'s Company`;
      const orgSlug = slugify(orgName) + '-' + userId.slice(-6);
      org = await prisma.organization.create({
        data: {
          name: orgName,
          orgType: "franchisor",
          slug: orgSlug,
          createdById: userId,
        },
      });
      await prisma.organizationMember.create({
        data: {
          organizationId: org.id,
          userId,
          memberRole: "owner",
          isPrimaryContact: true,
        },
      });
    }

    let industry = null;
    if (data.industry) {
      const indSlug = slugify(data.industry);
      industry = await prisma.industry.findUnique({ where: { slug: indSlug } });
      if (!industry) {
        industry = await prisma.industry.create({ data: { name: data.industry, slug: indSlug } });
      }
    }

    const brandSlug = slugify(data.name) + '-' + randomId();

    const brand = await prisma.franchiseBrand.create({
      data: {
        organizationId: org.id,
        name: data.name,
        slug: brandSlug,
        industryId: industry?.id || null,
        description: data.description || null,
        website: data.website || null,
        minInvestment: data.minInvestment ? parseFloat(data.minInvestment) : null,
        maxInvestment: data.maxInvestment ? parseFloat(data.maxInvestment) : null,
        franchiseFee: data.franchiseFee ? parseFloat(data.franchiseFee) : null,
        royaltyFeePct: data.royaltyFeePct ? parseFloat(data.royaltyFeePct) : null,
        marketingFeePct: data.marketingFeePct ? parseFloat(data.marketingFeePct) : null,
        netWorthRequirement: data.netWorthRequirement ? parseFloat(data.netWorthRequirement) : null,
        liquidCapitalRequirement: data.liquidCapitalRequirement ? parseFloat(data.liquidCapitalRequirement) : null,
        veteranDiscount: data.veteranDiscount || false,
        foundedYear: data.foundedYear ? parseInt(data.foundedYear) : null,
        franchisingsSinceYear: data.franchisingSinceYear ? parseInt(data.franchisingSinceYear) : null,
        totalUnits: data.totalUnits ? parseInt(data.totalUnits) : null,
      },
    });

    res.status(201).json({ brand });
  } catch (error) {
    console.error("Create brand error:", error);
    res.status(500).json({ error: error.message || "Failed to create brand" });
  }
});

app.get("/api/brands/:id", async (req, res) => {
  try {
    const session = await auth.api.getSession({
      headers: fromNodeHeaders(req.headers),
    });
    if (!session) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const brand = await prisma.franchiseBrand.findUnique({
      where: { id: req.params.id },
      include: {
        organization: { select: { id: true, name: true, logoUrl: true, website: true, description: true } },
        industry: { select: { id: true, name: true, slug: true } },
        _count: { select: { listings: true, documents: true } },
        documents: { select: { id: true, fileName: true, fileUrl: true, documentType: true, createdAt: true } },
      },
    });

    if (!brand) {
      return res.status(404).json({ error: "Brand not found" });
    }

    res.json({ brand: { ...brand, listingCount: brand._count.listings, documentCount: brand._count.documents, _count: undefined } });
  } catch (error) {
    console.error("Get brand error:", error);
    res.status(500).json({ error: error.message || "Failed to get brand" });
  }
});

app.put("/api/brands/:id", async (req, res) => {
  try {
    const session = await auth.api.getSession({
      headers: fromNodeHeaders(req.headers),
    });
    if (!session) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const data = req.body;
    const updateData = {};

    const fields = ["name", "description", "website", "logoUrl", "coverImageUrl", "foundedYear", "franchisingsSinceYear", "totalUnits", "franchiseFee", "royaltyFeePct", "marketingFeePct", "netWorthRequirement", "liquidCapitalRequirement", "veteranDiscount", "minInvestment", "maxInvestment"];
    for (const f of fields) {
      if (data[f] !== undefined) {
        updateData[f] = data[f];
      }
    }

    if (data.industry) {
      const indSlug = slugify(data.industry);
      let industry = await prisma.industry.findUnique({ where: { slug: indSlug } });
      if (!industry) {
        industry = await prisma.industry.create({ data: { name: data.industry, slug: indSlug } });
      }
      updateData.industryId = industry.id;
    }

    const brand = await prisma.franchiseBrand.update({
      where: { id: req.params.id },
      data: updateData,
    });

    res.json({ brand });
  } catch (error) {
    console.error("Update brand error:", error);
    res.status(500).json({ error: error.message || "Failed to update brand" });
  }
});

app.patch("/api/brands/:id/status", async (req, res) => {
  try {
    const session = await auth.api.getSession({
      headers: fromNodeHeaders(req.headers),
    });
    if (!session) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const { status } = req.body;
    const validStatuses = ["draft", "active", "paused", "archived"];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: "Invalid status" });
    }

    const brand = await prisma.franchiseBrand.update({
      where: { id: req.params.id },
      data: { status },
    });

    res.json({ brand });
  } catch (error) {
    console.error("Update brand status error:", error);
    res.status(500).json({ error: error.message || "Failed to update brand status" });
  }
});

// =====================================================================
// C7 — LISTINGS CRUD (Franchisor)
// =====================================================================
app.get("/api/brands/:id/listings", async (req, res) => {
  try {
    const session = await auth.api.getSession({
      headers: fromNodeHeaders(req.headers),
    });
    if (!session) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const listings = await prisma.franchiseListing.findMany({
      where: { franchiseBrandId: req.params.id },
      include: {
        territory: { select: { id: true, name: true, city: true, stateProvince: true, countryCode: true } },
        _count: { select: { leads: true, deals: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    res.json({ listings });
  } catch (error) {
    console.error("Get listings error:", error);
    res.status(500).json({ error: error.message || "Failed to get listings" });
  }
});

app.post("/api/listings", async (req, res) => {
  try {
    const session = await auth.api.getSession({
      headers: fromNodeHeaders(req.headers),
    });
    if (!session) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const userId = session.user.id;
    const { brandId, title, description, investmentMin, investmentMax, territoryId, status } = req.body;

    if (!brandId || !title) {
      return res.status(400).json({ error: "brandId and title are required" });
    }

    const listing = await prisma.franchiseListing.create({
      data: {
        franchiseBrandId: brandId,
        title,
        description: description || null,
        investmentMin: investmentMin ? parseFloat(investmentMin) : null,
        investmentMax: investmentMax ? parseFloat(investmentMax) : null,
        territoryId: territoryId || null,
        status: status || "draft",
        postedById: userId,
        listedAt: status === "active" ? new Date() : null,
      },
    });

    res.status(201).json({ listing });
  } catch (error) {
    console.error("Create listing error:", error);
    res.status(500).json({ error: error.message || "Failed to create listing" });
  }
});

app.put("/api/listings/:id", async (req, res) => {
  try {
    const session = await auth.api.getSession({
      headers: fromNodeHeaders(req.headers),
    });
    if (!session) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const data = req.body;
    const updateData = {};

    const fields = ["title", "description", "investmentMin", "investmentMax", "territoryId", "status"];
    for (const f of fields) {
      if (data[f] !== undefined) {
        updateData[f] = data[f];
      }
    }

    if (data.status === "active") {
      updateData.listedAt = new Date();
    }

    const listing = await prisma.franchiseListing.update({
      where: { id: req.params.id },
      data: updateData,
    });

    res.json({ listing });
  } catch (error) {
    console.error("Update listing error:", error);
    res.status(500).json({ error: error.message || "Failed to update listing" });
  }
});

// =====================================================================
// C8 — DEALS PIPELINE (Franchisor)
// =====================================================================
app.get("/api/deals", async (req, res) => {
  try {
    const session = await auth.api.getSession({
      headers: fromNodeHeaders(req.headers),
    });
    if (!session) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const userId = session.user.id;
    const { stage, brand, status } = req.query;

    const org = await prisma.organization.findFirst({
      where: { createdById: userId },
      select: { id: true },
    });
    if (!org) {
      return res.json({ deals: [] });
    }

    const listingIds = (await prisma.franchiseListing.findMany({
      where: { franchiseBrand: { organizationId: org.id } },
      select: { id: true },
    })).map(l => l.id);

    const where = { franchiseListingId: { in: listingIds } };
    if (stage) where.stage = stage;
    if (status) where.closedStatus = status;
    if (brand) {
      const brandListings = await prisma.franchiseListing.findMany({
        where: { franchiseBrandId: brand },
        select: { id: true },
      });
      where.franchiseListingId = { in: brandListings.map(l => l.id) };
    }

    const deals = await prisma.deal.findMany({
      where,
      include: {
        franchiseListing: { select: { id: true, title: true, franchiseBrand: { select: { id: true, name: true } } } },
        franchiseeUser: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
        stageHistory: { orderBy: { changedAt: "desc" }, take: 1 },
        _count: { select: { stageHistory: true } },
      },
      orderBy: { updatedAt: "desc" },
    });

    const enriched = deals.map(d => ({
      ...d,
      daysInStage: d.stageHistory.length > 0 ? daysBetween(d.stageHistory[0].changedAt, new Date()) : daysBetween(d.createdAt, new Date()),
    }));

    res.json({ deals: enriched });
  } catch (error) {
    console.error("Get deals error:", error);
    res.status(500).json({ error: error.message || "Failed to get deals" });
  }
});

app.patch("/api/deals/:id/stage", async (req, res) => {
  try {
    const session = await auth.api.getSession({
      headers: fromNodeHeaders(req.headers),
    });
    if (!session) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const userId = session.user.id;
    const { stage, notes } = req.body;

    if (!stage) {
      return res.status(400).json({ error: "stage is required" });
    }

    const deal = await prisma.deal.findUnique({ where: { id: req.params.id } });
    if (!deal) {
      return res.status(404).json({ error: "Deal not found" });
    }

    const result = await prisma.$transaction(async (tx) => {
      await tx.dealStageHistory.create({
        data: {
          dealId: deal.id,
          fromStage: deal.stage,
          toStage: stage,
          changedBy: userId,
          notes: notes || null,
        },
      });

      const updated = await tx.deal.update({
        where: { id: deal.id },
        data: { stage },
        include: {
          franchiseListing: { select: { id: true, title: true, franchiseBrand: { select: { id: true, name: true } } } },
          franchiseeUser: { select: { id: true, firstName: true, lastName: true } },
        },
      });

      return updated;
    });

    res.json({ deal: result });
  } catch (error) {
    console.error("Update deal stage error:", error);
    res.status(500).json({ error: error.message || "Failed to update deal stage" });
  }
});

// =====================================================================
// C9 — CONNECTIONS
// =====================================================================
app.get("/api/connections", async (req, res) => {
  try {
    const session = await auth.api.getSession({
      headers: fromNodeHeaders(req.headers),
    });
    if (!session) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const userId = session.user.id;

    const connections = await prisma.connection.findMany({
      where: { status: "accepted", OR: [{ requesterId: userId }, { addresseeId: userId }] },
      include: {
        requester: { select: { id: true, firstName: true, lastName: true, avatarUrl: true, headline: true } },
        addressee: { select: { id: true, firstName: true, lastName: true, avatarUrl: true, headline: true } },
      },
      orderBy: { requestedAt: "desc" },
    });

    const pending = await prisma.connection.findMany({
      where: { addresseeId: userId, status: "pending" },
      include: {
        requester: { select: { id: true, firstName: true, lastName: true, avatarUrl: true, headline: true } },
      },
      orderBy: { requestedAt: "desc" },
    });

    const sent = await prisma.connection.findMany({
      where: { requesterId: userId, status: "pending" },
      include: {
        addressee: { select: { id: true, firstName: true, lastName: true, avatarUrl: true, headline: true } },
      },
      orderBy: { requestedAt: "desc" },
    });

    res.json({ connections, pending, sent });
  } catch (error) {
    console.error("Get connections error:", error);
    res.status(500).json({ error: error.message || "Failed to get connections" });
  }
});

app.post("/api/connections/request", async (req, res) => {
  try {
    const session = await auth.api.getSession({
      headers: fromNodeHeaders(req.headers),
    });
    if (!session) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const userId = session.user.id;
    const { userId: targetUserId } = req.body;

    if (!targetUserId || targetUserId === userId) {
      return res.status(400).json({ error: "Invalid user ID" });
    }

    const existing = await prisma.connection.findUnique({
      where: { requesterId_addresseeId: { requesterId: userId, addresseeId: targetUserId } },
    });
    if (existing) {
      return res.status(409).json({ error: "Connection request already exists" });
    }

    const connection = await prisma.connection.create({
      data: { requesterId: userId, addresseeId: targetUserId },
      include: {
        addressee: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
      },
    });

    res.status(201).json({ connection });
  } catch (error) {
    console.error("Request connection error:", error);
    res.status(500).json({ error: error.message || "Failed to request connection" });
  }
});

app.patch("/api/connections/:id", async (req, res) => {
  try {
    const session = await auth.api.getSession({
      headers: fromNodeHeaders(req.headers),
    });
    if (!session) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const { status } = req.body;
    if (!["accepted", "declined"].includes(status)) {
      return res.status(400).json({ error: "Status must be 'accepted' or 'declined'" });
    }

    const connection = await prisma.connection.update({
      where: { id: req.params.id },
      data: { status, respondedAt: new Date() },
      include: {
        requester: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
        addressee: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
      },
    });

    res.json({ connection });
  } catch (error) {
    console.error("Update connection error:", error);
    res.status(500).json({ error: error.message || "Failed to update connection" });
  }
});

// =====================================================================
// C10 — MESSAGES
// =====================================================================
app.get("/api/conversations", async (req, res) => {
  try {
    const session = await auth.api.getSession({
      headers: fromNodeHeaders(req.headers),
    });
    if (!session) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const userId = session.user.id;

    const conversations = await prisma.conversation.findMany({
      where: {
        messages: {
          some: {
            OR: [{ senderId: userId }, { recipientId: userId }],
          },
        },
      },
      include: {
        messages: {
          orderBy: { createdAt: "desc" },
          take: 1,
          include: {
            sender: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
            recipient: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
          },
        },
      },
      orderBy: { updatedAt: "desc" },
    });

    let enriched = await Promise.all(conversations.map(async (conv) => {
      const lastMessage = conv.messages[0];
      const otherUser = lastMessage
        ? (lastMessage.senderId === userId ? lastMessage.recipient : lastMessage.sender)
        : null;

      const unreadCount = await prisma.message.count({
        where: { conversationId: conv.id, recipientId: userId, senderId: { not: userId } },
      });

      return {
        id: conv.id,
        type: conv.type,
        lastMessage: lastMessage ? { content: lastMessage.content, createdAt: lastMessage.createdAt } : null,
        otherUser,
        unreadCount,
        updatedAt: conv.updatedAt,
        createdAt: conv.createdAt,
      };
    }));

    enriched.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));

    res.json({ conversations: enriched });
  } catch (error) {
    console.error("Get conversations error:", error);
    res.status(500).json({ error: error.message || "Failed to get conversations" });
  }
});

app.get("/api/conversations/:id/messages", async (req, res) => {
  try {
    const session = await auth.api.getSession({
      headers: fromNodeHeaders(req.headers),
    });
    if (!session) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const userId = session.user.id;
    const conversationId = req.params.id;
    const pageNum = Math.max(1, parseInt(req.query.page) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(req.query.limit) || 50));
    const skip = (pageNum - 1) * limitNum;

    const isParticipant = await prisma.message.findFirst({
      where: { conversationId, OR: [{ senderId: userId }, { recipientId: userId }] },
    });
    if (!isParticipant) {
      return res.status(403).json({ error: "Not a participant in this conversation" });
    }

    const [messages, total] = await Promise.all([
      prisma.message.findMany({
        where: { conversationId },
        include: {
          sender: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
          recipient: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limitNum,
      }),
      prisma.message.count({ where: { conversationId } }),
    ]);

    res.json({ messages: messages.reverse(), total });
  } catch (error) {
    console.error("Get messages error:", error);
    res.status(500).json({ error: error.message || "Failed to get messages" });
  }
});

app.post("/api/conversations/:id/messages", async (req, res) => {
  try {
    const session = await auth.api.getSession({
      headers: fromNodeHeaders(req.headers),
    });
    if (!session) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const userId = session.user.id;
    const conversationId = req.params.id;
    const { content } = req.body;

    if (!content || !content.trim()) {
      return res.status(400).json({ error: "Content is required" });
    }

    const isParticipant = await prisma.message.findFirst({
      where: { conversationId, OR: [{ senderId: userId }, { recipientId: userId }] },
    });
    if (!isParticipant) {
      return res.status(403).json({ error: "Not a participant in this conversation" });
    }

    const otherMessage = await prisma.message.findFirst({
      where: { conversationId, senderId: { not: userId } },
      select: { senderId: true },
    });

    const message = await prisma.message.create({
      data: {
        conversationId,
        senderId: userId,
        recipientId: otherMessage?.senderId || null,
        content: content.trim(),
      },
      include: {
        sender: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
      },
    });

    await prisma.conversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date() },
    });

    res.status(201).json({ message });
  } catch (error) {
    console.error("Create message error:", error);
    res.status(500).json({ error: error.message || "Failed to create message" });
  }
});

app.post("/api/conversations", async (req, res) => {
  try {
    const session = await auth.api.getSession({
      headers: fromNodeHeaders(req.headers),
    });
    if (!session) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const userId = session.user.id;
    const { participantId, content } = req.body;

    if (!participantId || !content || !content.trim()) {
      return res.status(400).json({ error: "participantId and content are required" });
    }

    const existingConv = await prisma.conversation.findFirst({
      where: {
        type: "direct",
        AND: [
          { messages: { some: { senderId: userId, recipientId: participantId } } },
          { messages: { some: { senderId: participantId, recipientId: userId } } },
        ],
      },
    });

    if (existingConv) {
      const message = await prisma.message.create({
        data: {
          conversationId: existingConv.id,
          senderId: userId,
          recipientId: participantId,
          content: content.trim(),
        },
        include: {
          sender: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
        },
      });

      await prisma.conversation.update({
        where: { id: existingConv.id },
        data: { updatedAt: new Date() },
      });

      return res.status(201).json({ conversation: existingConv, message });
    }

    const result = await prisma.$transaction(async (tx) => {
      const conversation = await tx.conversation.create({
        data: { type: "direct" },
      });

      const message = await tx.message.create({
        data: {
          conversationId: conversation.id,
          senderId: userId,
          recipientId: participantId,
          content: content.trim(),
        },
        include: {
          sender: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
        },
      });

      return { conversation, message };
    });

    res.status(201).json(result);
  } catch (error) {
    console.error("Create conversation error:", error);
    res.status(500).json({ error: error.message || "Failed to create conversation" });
  }
});

// =====================================================================
// C11 — PROFILE
// =====================================================================
app.get("/api/profile", async (req, res) => {
  try {
    const session = await auth.api.getSession({
      headers: fromNodeHeaders(req.headers),
    });
    if (!session) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const userId = session.user.id;

    const userRole = await prisma.userRole.findFirst({
      where: { userId, isPrimary: true },
    });

    if (!userRole) {
      return res.status(400).json({ error: "No role assigned" });
    }

    const baseUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, firstName: true, lastName: true, email: true, phone: true, avatarUrl: true, headline: true, bio: true, city: true, stateProvince: true, countryCode: true },
    });

    let profileData = { user: baseUser };

    if (userRole.role === "franchisee") {
      const franchiseeProfile = await prisma.franchiseeProfile.findUnique({
        where: { userId },
        include: {
          industryInterests: { include: { industry: { select: { id: true, name: true, slug: true } } } },
          locationInterests: true,
        },
      });
      profileData.profile = franchiseeProfile;
    } else {
      const org = await prisma.organization.findFirst({
        where: { createdById: userId },
        include: {
          industry: { select: { id: true, name: true } },
          address: true,
        },
      });
      profileData.organization = org;
    }

    res.json(profileData);
  } catch (error) {
    console.error("Get profile error:", error);
    res.status(500).json({ error: error.message || "Failed to get profile" });
  }
});

app.put("/api/profile", async (req, res) => {
  try {
    const session = await auth.api.getSession({
      headers: fromNodeHeaders(req.headers),
    });
    if (!session) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const userId = session.user.id;
    const data = req.body;

    const userRole = await prisma.userRole.findFirst({
      where: { userId, isPrimary: true },
    });

    if (!userRole) {
      return res.status(400).json({ error: "No role assigned" });
    }

    const userFields = ["firstName", "lastName", "phone", "headline", "bio", "city", "stateProvince", "countryCode"];
    const userUpdate = {};
    for (const f of userFields) {
      if (data[f] !== undefined) userUpdate[f] = data[f];
    }
    if (Object.keys(userUpdate).length > 0) {
      await prisma.user.update({ where: { id: userId }, data: userUpdate });
    }

    if (userRole.role === "franchisee") {
      const profileFields = ["investmentCapacityMin", "investmentCapacityMax", "liquidCapital", "netWorth", "experienceBackground", "timeline", "creditScoreBand"];
      const profileUpdate = {};
      for (const f of profileFields) {
        if (data[f] !== undefined) profileUpdate[f] = data[f];
      }
      if (Object.keys(profileUpdate).length > 0) {
        await prisma.franchiseeProfile.upsert({
          where: { userId },
          create: { userId, ...profileUpdate },
          update: profileUpdate,
        });
      }

      if (data.industries) {
        await prisma.franchiseeIndustryInterest.deleteMany({ where: { franchiseeUserId: userId } });
        const names = data.industries.split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
        for (const name of names) {
          const indSlug = slugify(name);
          let industry = await prisma.industry.findUnique({ where: { slug: indSlug } });
          if (!industry) {
            industry = await prisma.industry.create({ data: { name, slug: indSlug } });
          }
          await prisma.franchiseeIndustryInterest.create({
            data: { franchiseeUserId: userId, industryId: industry.id },
          }).catch(() => {});
        }
      }

      if (data.locations) {
        await prisma.franchiseeLocationInterest.deleteMany({ where: { franchiseeUserId: userId } });
        const locs = data.locations.split(';').map(s => s.trim()).filter(Boolean);
        for (const loc of locs) {
          const parts = loc.split(',').map(s => s.trim());
          await prisma.franchiseeLocationInterest.create({
            data: {
              franchiseeUserId: userId,
              city: parts[0] || null,
              stateProvince: parts[1] || null,
              countryCode: parts[2] ? parts[2].substring(0, 2).toUpperCase() : null,
            },
          });
        }
      }
    } else {
      const orgFields = ["name", "website", "description", "employeeCount"];
      const orgUpdate = {};
      for (const f of orgFields) {
        if (data[f] !== undefined) orgUpdate[f] = data[f];
      }
      if (Object.keys(orgUpdate).length > 0) {
        await prisma.organization.updateMany({
          where: { createdById: userId },
          data: orgUpdate,
        });
      }
    }

    res.json({ success: true });
  } catch (error) {
    console.error("Update profile error:", error);
    res.status(500).json({ error: error.message || "Failed to update profile" });
  }
});

// =====================================================================
// C12 — NOTIFICATIONS
// =====================================================================
app.get("/api/notifications", async (req, res) => {
  try {
    const session = await auth.api.getSession({
      headers: fromNodeHeaders(req.headers),
    });
    if (!session) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const userId = session.user.id;

    const notifications = [];

    const recentStageChanges = await prisma.dealStageHistory.findMany({
      where: { changedBy: userId },
      include: { deal: { select: { id: true, franchiseListing: { select: { title: true } } } } },
      orderBy: { changedAt: "desc" },
      take: 10,
    });

    for (const h of recentStageChanges) {
      notifications.push({
        id: `stage-${h.id}`,
        type: "deal_stage",
        title: "Deal stage updated",
        message: `Deal for ${h.deal.franchiseListing.title} moved to ${h.toStage}`,
        createdAt: h.changedAt,
        read: false,
        data: { dealId: h.dealId },
      });
    }

    const recentLeads = await prisma.lead.findMany({
      where: { franchiseeUserId: userId },
      include: { franchiseListing: { select: { title: true, franchiseBrand: { select: { name: true } } } } },
      orderBy: { createdAt: "desc" },
      take: 10,
    });

    for (const l of recentLeads) {
      notifications.push({
        id: `lead-${l.id}`,
        type: "lead",
        title: "New inquiry",
        message: `You requested information about ${l.franchiseListing.franchiseBrand.name} - ${l.franchiseListing.title}`,
        createdAt: l.createdAt,
        read: false,
        data: { leadId: l.id },
      });
    }

    const recentConnections = await prisma.connection.findMany({
      where: { OR: [{ requesterId: userId }, { addresseeId: userId }] },
      include: {
        requester: { select: { firstName: true, lastName: true } },
        addressee: { select: { firstName: true, lastName: true } },
      },
      orderBy: { requestedAt: "desc" },
      take: 10,
    });

    for (const c of recentConnections) {
      const otherName = c.requesterId === userId ? `${c.addressee.firstName} ${c.addressee.lastName}` : `${c.requester.firstName} ${c.requester.lastName}`;
      const isIncoming = c.addresseeId === userId;
      notifications.push({
        id: `conn-${c.id}`,
        type: "connection",
        title: isIncoming ? "Connection request" : "Connection sent",
        message: isIncoming ? `${otherName} wants to connect` : `You sent a connection request to ${otherName}`,
        createdAt: c.requestedAt,
        read: c.status !== "pending",
        data: { connectionId: c.id, status: c.status },
      });
    }

    const recentMessages = await prisma.message.findMany({
      where: { recipientId: userId },
      include: { sender: { select: { firstName: true, lastName: true } } },
      orderBy: { createdAt: "desc" },
      take: 10,
    });

    for (const m of recentMessages) {
      notifications.push({
        id: `msg-${m.id}`,
        type: "message",
        title: "New message",
        message: `${m.sender.firstName} ${m.sender.lastName} sent you a message`,
        createdAt: m.createdAt,
        read: false,
        data: { conversationId: m.conversationId, messageId: m.id },
      });
    }

    notifications.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    const unreadCount = notifications.filter(n => !n.read).length;

    res.json({ notifications: notifications.slice(0, 50), unreadCount });
  } catch (error) {
    console.error("Get notifications error:", error);
    res.status(500).json({ error: error.message || "Failed to get notifications" });
  }
});

app.post("/api/notifications/read", async (req, res) => {
  res.json({ success: true });
});

// =====================================================================
// C13 — ORGANIZATION (Franchisor)
// =====================================================================
app.get("/api/org", async (req, res) => {
  try {
    const session = await auth.api.getSession({
      headers: fromNodeHeaders(req.headers),
    });
    if (!session) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const userId = session.user.id;

    const organization = await prisma.organization.findFirst({
      where: { createdById: userId },
      include: {
        industry: { select: { id: true, name: true } },
        address: true,
      },
    });

    if (!organization) {
      return res.status(404).json({ error: "No organization found" });
    }

    const members = await prisma.organizationMember.findMany({
      where: { organizationId: organization.id },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, email: true, avatarUrl: true, phone: true } },
      },
    });

    res.json({ organization, members });
  } catch (error) {
    console.error("Get org error:", error);
    res.status(500).json({ error: error.message || "Failed to get organization" });
  }
});

app.put("/api/org", async (req, res) => {
  try {
    const session = await auth.api.getSession({
      headers: fromNodeHeaders(req.headers),
    });
    if (!session) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const userId = session.user.id;
    const data = req.body;

    const orgFields = ["name", "website", "description", "logoUrl", "employeeCount"];
    const updateData = {};
    for (const f of orgFields) {
      if (data[f] !== undefined) updateData[f] = data[f];
    }

    const organization = await prisma.organization.updateMany({
      where: { createdById: userId },
      data: updateData,
    });

    const org = await prisma.organization.findFirst({
      where: { createdById: userId },
    });

    res.json({ organization: org });
  } catch (error) {
    console.error("Update org error:", error);
    res.status(500).json({ error: error.message || "Failed to update organization" });
  }
});

app.post("/api/org/members", async (req, res) => {
  try {
    const session = await auth.api.getSession({
      headers: fromNodeHeaders(req.headers),
    });
    if (!session) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const userId = session.user.id;
    const { email, memberRole } = req.body;

    if (!email) {
      return res.status(400).json({ error: "Email is required" });
    }

    const org = await prisma.organization.findFirst({
      where: { createdById: userId },
    });
    if (!org) {
      return res.status(404).json({ error: "No organization found" });
    }

    const targetUser = await prisma.user.findUnique({ where: { email } });
    if (!targetUser) {
      return res.status(404).json({ error: "User not found with that email" });
    }

    const existingMember = await prisma.organizationMember.findUnique({
      where: { organizationId_userId: { organizationId: org.id, userId: targetUser.id } },
    });
    if (existingMember) {
      return res.status(409).json({ error: "User is already a member" });
    }

    const member = await prisma.organizationMember.create({
      data: {
        organizationId: org.id,
        userId: targetUser.id,
        memberRole: memberRole || "member",
      },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, email: true, avatarUrl: true } },
      },
    });

    res.status(201).json({ member });
  } catch (error) {
    console.error("Add member error:", error);
    res.status(500).json({ error: error.message || "Failed to add member" });
  }
});

// Serve static frontend files
const rootDir = path.resolve(__dirname, "..");
app.use(express.static(rootDir));

// Error handling
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: err.message || "Internal server error" });
});

app.listen(PORT, () => {
  console.log(`FranchiseHub with Better Auth on http://localhost:${PORT}`);
});
