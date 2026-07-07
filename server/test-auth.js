// Test Script for FranchiseHub Auth System
// File: server/test-auth.js
// Run with: node server/test-auth.js

import { PrismaClient } from "@prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";

const neon = new PrismaNeon({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter: neon });

async function testAuth() {
  try {
    console.log("🧪 FranchiseHub Auth System - Test Suite\n");

    // Test 1: Check database connection
    console.log("1️⃣  Testing database connection...");
    const userCount = await prisma.user.count();
    console.log(`   ✅ Connected! Total users: ${userCount}\n`);

    // Test 2: List all users
    console.log("2️⃣  Listing all users...");
    const users = await prisma.user.findMany({
      include: {
        userRoles: true,
      },
    });

    if (users.length === 0) {
      console.log("   📭 No users found yet\n");
    } else {
      users.forEach((user, i) => {
        console.log(`   ${i + 1}. ${user.firstName} ${user.lastName}`);
        console.log(`      Email: ${user.email}`);
        console.log(`      Roles: ${user.userRoles.map((r) => r.role).join(", ")}`);
        console.log(`      Created: ${user.createdAt.toLocaleDateString()}\n`);
      });
    }

    // Test 3: Check franchisors
    console.log("3️⃣  Checking Franchisor accounts...");
    const franchisors = await prisma.user.findMany({
      where: {
        userRoles: {
          some: {
            role: "FRANCHISOR",
          },
        },
      },
      include: {
        userRoles: true,
      },
    });

    if (franchisors.length === 0) {
      console.log("   📭 No franchisor accounts yet\n");
    } else {
      console.log(`   ✅ Found ${franchisors.length} franchisor(s)\n`);
    }

    // Test 4: Check brokers
    console.log("4️⃣  Checking Broker accounts...");
    const brokers = await prisma.user.findMany({
      where: {
        userRoles: {
          some: {
            role: "BROKER",
          },
        },
      },
    });

    if (brokers.length === 0) {
      console.log("   📭 No broker accounts yet\n");
    } else {
      console.log(`   ✅ Found ${brokers.length} broker(s)\n`);
    }

    // Test 5: Check franchisees
    console.log("5️⃣  Checking Franchisee accounts...");
    const franchisees = await prisma.user.findMany({
      where: {
        userRoles: {
          some: {
            role: "FRANCHISEE",
          },
        },
      },
    });

    if (franchisees.length === 0) {
      console.log("   📭 No franchisee accounts yet\n");
    } else {
      console.log(`   ✅ Found ${franchisees.length} franchisee(s)\n`);
    }

    // Test 6: Database schema info
    console.log("6️⃣  Database Schema Summary...");
    console.log("   Tables:");

    const tables = [
      "users",
      "user_roles",
      "organizations",
      "organization_members",
      "broker_profiles",
      "broker_representations",
      "franchisee_profiles",
      "franchise_brands",
      "franchise_listings",
      "leads",
      "deals",
    ];

    for (const table of tables) {
      try {
        const count = await prisma.$queryRawUnsafe(
          `SELECT COUNT(*) as count FROM "${table}"`
        );
        console.log(`   - ${table}: ${count[0].count} records`);
      } catch (e) {
        console.log(`   - ${table}: (error checking count)`);
      }
    }

    console.log("\n✅ Auth System Test Complete!\n");
    console.log("📖 Next Steps:");
    console.log("  1. Start server: npm run dev");
    console.log("  2. Open auth.html in browser");
    console.log("  3. Create account or login");
    console.log("  4. Run this test again to see new data\n");
  } catch (error) {
    console.error("❌ Test failed:", error.message);
  } finally {
    await prisma.$disconnect();
  }
}

testAuth();
