/**
 * Migration: backfill isPhoneVerified = true on all existing model documents.
 *
 * Background:
 *   The `isPhoneVerified` field gates model login in xs_backend. Existing models
 *   who registered before this field was added have no value — causing a
 *   PHONE_NOT_VERIFIED 403 on their next login attempt.
 *
 *   This script sets isPhoneVerified = true on every model document that doesn't
 *   already have the field, treating all existing accounts as pre-verified.
 *
 * Run ONCE before (or immediately after) deploying the isPhoneVerified login gate.
 *
 * Usage:
 *   bun run migrate:phone-verified
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function run() {
  console.log("Starting migration: backfill isPhoneVerified on model collection\n");

  try {
    const result = await prisma.$runCommandRaw({
      update: "model",
      updates: [
        {
          q: { isPhoneVerified: { $exists: false } },
          u: { $set: { isPhoneVerified: true } },
          multi: true,
        },
      ],
    });

    const { n, nModified } = result as { n: number; nModified: number };

    if (nModified === 0 && n === 0) {
      console.log("✓ Nothing to migrate — all model documents already have isPhoneVerified set.");
    } else {
      console.log(`✓ Updated ${nModified} model document(s) → isPhoneVerified = true`);
    }

    // Verify
    const check = await prisma.$runCommandRaw({
      count: "model",
      query: { isPhoneVerified: { $exists: false } },
    });

    const remaining = (check as { n: number }).n ?? 0;
    if (remaining > 0) {
      console.warn(`⚠ ${remaining} document(s) still missing isPhoneVerified — re-run the script.`);
      process.exit(1);
    } else {
      console.log("✓ Verification passed — no documents missing isPhoneVerified.");
    }
  } catch (err) {
    console.error("Migration failed:", err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
    console.log("Done.");
  }
}

run();
