// Example usage of Prisma Client with the Franchise schema
import { PrismaClient } from "../generated/prisma";

const prisma = new PrismaClient();

// Example 1: Create a user
async function createUser() {
  const user = await prisma.user.create({
    data: {
      email: "john@example.com",
      firstName: "John",
      lastName: "Doe",
      passwordHash: "hashed_password_here",
      userRoles: {
        create: [
          {
            role: "franchisor",
            isPrimary: true,
          },
        ],
      },
    },
  });
  return user;
}

// Example 2: Create an organization
async function createOrganization(userId: string) {
  const org = await prisma.organization.create({
    data: {
      name: "McDonald's Franchise Corp",
      orgType: "franchisor",
      slug: "mcdonalds-corp",
      createdById: userId,
      members: {
        create: [
          {
            userId,
            memberRole: "owner",
            isPrimaryContact: true,
          },
        ],
      },
    },
  });
  return org;
}

// Example 3: Create a franchise brand
async function createFranchiseBrand(organizationId: string) {
  const brand = await prisma.franchiseBrand.create({
    data: {
      organizationId,
      name: "McDonald's",
      slug: "mcdonalds",
      minInvestment: 1000000,
      maxInvestment: 2500000,
      franchiseFee: 45000,
      royaltyFeePct: 5.5,
      marketingFeePct: 1.0,
      status: "active",
    },
  });
  return brand;
}

// Example 4: Get all active franchise listings
async function getActiveFranchises() {
  const listings = await prisma.franchiseListing.findMany({
    where: {
      status: "active",
    },
    include: {
      franchiseBrand: {
        include: {
          organization: true,
        },
      },
      territory: true,
    },
  });
  return listings;
}

// Example 5: Create a lead
async function createLead(
  listingId: string,
  franchiseeUserId: string
) {
  const lead = await prisma.lead.create({
    data: {
      franchiseListingId: listingId,
      franchiseeUserId,
      source: "platform_search",
      status: "new",
    },
  });
  return lead;
}

// Example 6: Convert lead to deal
async function leadToDeal(leadId: string, brokerUserId?: string) {
  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
  });

  if (!lead) throw new Error("Lead not found");

  const deal = await prisma.deal.create({
    data: {
      leadId,
      franchiseListingId: lead.franchiseListingId,
      franchiseeUserId: lead.franchiseeUserId,
      brokerUserId,
      stage: "inquiry",
      closedStatus: "open",
    },
  });

  return deal;
}

// Example 7: Update deal stage
async function updateDealStage(
  dealId: string,
  newStage: string,
  changedBy: string
) {
  await prisma.dealStageHistory.create({
    data: {
      dealId,
      toStage: newStage as any,
      changedBy,
    },
  });

  const updatedDeal = await prisma.deal.update({
    where: { id: dealId },
    data: {
      stage: newStage as any,
    },
  });

  return updatedDeal;
}

// Example 8: Create a connection request
async function createConnection(requesterId: string, addresseeId: string) {
  const connection = await prisma.connection.create({
    data: {
      requesterId,
      addresseeId,
      status: "pending",
    },
  });
  return connection;
}

// Clean up
async function cleanup() {
  await prisma.$disconnect();
}

// Main execution (commented out)
/*
async function main() {
  try {
    const user = await createUser();
    console.log("Created user:", user);

    const org = await createOrganization(user.id);
    console.log("Created organization:", org);

    const brand = await createFranchiseBrand(org.id);
    console.log("Created franchise brand:", brand);
  } catch (error) {
    console.error(error);
  } finally {
    await cleanup();
  }
}

main();
*/

export {
  createUser,
  createOrganization,
  createFranchiseBrand,
  getActiveFranchises,
  createLead,
  leadToDeal,
  updateDealStage,
  createConnection,
};
