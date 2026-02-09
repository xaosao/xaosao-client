/**
 * Migration script to add soft-delete fields (customerHidden, modelHidden)
 * to all existing service_booking and transaction_history documents.
 *
 * This sets customerHidden=false and modelHidden=false on documents
 * that don't have these fields yet.
 *
 * Run with: npx tsx scripts/migrate-soft-delete-fields.ts
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function migrateSoftDeleteFields() {
  console.log("Starting migration: Add soft-delete fields to service_booking and transaction_history\n");

  try {
    // 1. Update service_booking - add customerHidden: false where field doesn't exist
    const bookingCustomerResult = await prisma.$runCommandRaw({
      update: "service_booking",
      updates: [
        {
          q: { customerHidden: { $exists: false } },
          u: { $set: { customerHidden: false } },
          multi: true,
        },
      ],
    });
    console.log("service_booking (customerHidden):", JSON.stringify(bookingCustomerResult, null, 2));

    // 2. Update service_booking - add modelHidden: false where field doesn't exist
    const bookingModelResult = await prisma.$runCommandRaw({
      update: "service_booking",
      updates: [
        {
          q: { modelHidden: { $exists: false } },
          u: { $set: { modelHidden: false } },
          multi: true,
        },
      ],
    });
    console.log("service_booking (modelHidden):", JSON.stringify(bookingModelResult, null, 2));

    // 3. Update transaction_history - add customerHidden: false where field doesn't exist
    const txCustomerResult = await prisma.$runCommandRaw({
      update: "transaction_history",
      updates: [
        {
          q: { customerHidden: { $exists: false } },
          u: { $set: { customerHidden: false } },
          multi: true,
        },
      ],
    });
    console.log("transaction_history (customerHidden):", JSON.stringify(txCustomerResult, null, 2));

    // 4. Update transaction_history - add modelHidden: false where field doesn't exist
    const txModelResult = await prisma.$runCommandRaw({
      update: "transaction_history",
      updates: [
        {
          q: { modelHidden: { $exists: false } },
          u: { $set: { modelHidden: false } },
          multi: true,
        },
      ],
    });
    console.log("transaction_history (modelHidden):", JSON.stringify(txModelResult, null, 2));

    console.log("\nMigration completed successfully!");
  } catch (error) {
    console.error("Migration failed:", error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

migrateSoftDeleteFields();
