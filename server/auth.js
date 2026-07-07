import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { PrismaClient } from "@prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";
import dotenv from "dotenv";
dotenv.config();

const prisma = new PrismaClient({
  adapter: new PrismaNeon({ connectionString: process.env.DATABASE_URL }),
});

export { prisma };

export const auth = betterAuth({
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: process.env.BETTER_AUTH_URL || "http://localhost:3001",
  emailAndPassword: {
    enabled: true,
    autoSignIn: true,
    requireEmailVerification: false,
    sendResetPassword: async ({ user, url }) => {
      console.log(`Password reset email to ${user.email}: ${url}`);
    },
  },
  emailVerification: {
    sendOnSignUp: true,
    autoSignInAfterVerification: true,
    sendVerificationEmail: async ({ user, url }) => {
      console.log(`Verification email to ${user.email}: ${url}`);
    },
  },
  advanced: {
    disableOriginCheck: process.env.NODE_ENV !== "production",
    disableCSRFCheck: process.env.NODE_ENV !== "production",
  },
  user: {
    additionalFields: {
      firstName: { type: "string", required: true },
      lastName: { type: "string", required: true },
      phone: { type: "string", required: false },
      city: { type: "string", required: false },
      stateProvince: { type: "string", required: false },
      countryCode: { type: "string", required: false },
      headline: { type: "string", required: false },
      bio: { type: "string", required: false },
      isActive: { type: "boolean", required: false, defaultValue: true },
    },
  },
});
