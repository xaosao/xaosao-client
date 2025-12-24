/**
 * Migration script to convert bank_account_number from Float to String
 *
 * Run with: npx tsx scripts/migrate-bank-account-number.ts
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function migrateBankAccountNumbers() {
  console.log("Starting migration: bank_account_number Float -> String");

  try {
    // Use MongoDB's $runCommandRaw to update all banks
    // Convert bank_account_number from number to string using $toString
    const result = await prisma.$runCommandRaw({
      update: "banks",
      updates: [
        {
          q: {
            bank_account_number: { $type: "double" }, // Find all documents where it's a number
          },
          u: [
            {
              $set: {
                bank_account_number: { $toString: "$bank_account_number" },
              },
            },
          ],
          multi: true,
        },
      ],
    });

    console.log("Migration result:", JSON.stringify(result, null, 2));
    console.log("Migration completed successfully!");
  } catch (error) {
    console.error("Migration failed:", error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

migrateBankAccountNumbers();
