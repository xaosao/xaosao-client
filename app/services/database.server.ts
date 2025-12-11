import { PrismaClient } from "@prisma/client";

declare global {
  var __db: PrismaClient | undefined;
}

let prisma: PrismaClient;

if (process.env.NODE_ENV === "production") {
  prisma = new PrismaClient();
  // No $connect() needed - Prisma connects automatically on first query
} else {
  if (!global.__db) {
    global.__db = new PrismaClient();
    // No $connect() needed - Prisma connects automatically on first query
  }
  prisma = global.__db;
}

export { prisma };
