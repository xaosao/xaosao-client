/**
 * Migration script to convert paymentSlip from String to String[] (Array)
 * in the transaction_history collection.
 *
 * This converts existing string values to single-element arrays,
 * and sets empty array [] for documents where paymentSlip is null.
 *
 * Run with: npx tsx scripts/migrate-payment-slip-to-array.ts
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function migratePaymentSlipToArray() {
  console.log("Starting migration: Convert paymentSlip from String to String[]\n");

  try {
    // 1. Convert existing string paymentSlip values to single-element arrays
    // Match documents where paymentSlip is a string (not null, not already an array)
    const stringToArrayResult = await prisma.$runCommandRaw({
      update: "transaction_history",
      updates: [
        {
          q: {
            paymentSlip: { $type: "string" },
          },
          u: [
            {
              $set: {
                paymentSlip: ["$paymentSlip"],
              },
            },
          ],
          multi: true,
        },
      ],
    });
    console.log("Convert string paymentSlip to array:", JSON.stringify(stringToArrayResult, null, 2));

    // 2. Set empty array for documents where paymentSlip is null or doesn't exist
    const nullToArrayResult = await prisma.$runCommandRaw({
      update: "transaction_history",
      updates: [
        {
          q: {
            $or: [
              { paymentSlip: { $exists: false } },
              { paymentSlip: null },
            ],
          },
          u: { $set: { paymentSlip: [] } },
          multi: true,
        },
      ],
    });
    console.log("Set empty array for null paymentSlip:", JSON.stringify(nullToArrayResult, null, 2));

    console.log("\nMigration completed successfully!");
  } catch (error) {
    console.error("Migration failed:", error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

migratePaymentSlipToArray();
