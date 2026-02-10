/**
 * Migration script to add isProfileHidden field to all existing model documents.
 *
 * This sets isProfileHidden=false on documents that don't have the field yet.
 *
 * Run with: npx tsx scripts/migrate-profile-hidden-field.ts
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function migrateProfileHiddenField() {
  console.log("Starting migration: Add isProfileHidden field to model collection\n");

  try {
    const result = await prisma.$runCommandRaw({
      update: "model",
      updates: [
        {
          q: { isProfileHidden: { $exists: false } },
          u: { $set: { isProfileHidden: false } },
          multi: true,
        },
      ],
    });
    console.log("model (isProfileHidden):", JSON.stringify(result, null, 2));

    console.log("\nMigration completed successfully!");
  } catch (error) {
    console.error("Migration failed:", error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

migrateProfileHiddenField();
