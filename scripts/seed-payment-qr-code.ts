/**
 * Seed / update the payment QR code URL in `system_config`.
 *
 * Run once after first deploy, and again any time you change the QR code
 * image on your CDN. Safe to re-run — uses upsert so it never duplicates.
 *
 * Usage:
 *   QR_CODE_URL="https://your-cdn.b-cdn.net/qr-code.png" bun run seed:payment-qr
 *
 * Or set the URL directly below and run:
 *   bun run seed:payment-qr
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// ─── CONFIG ────────────────────────────────────────────────────────────────
// Set via env var (recommended for production) OR hard-code below.
const QR_CODE_URL =
  process.env.QR_CODE_URL ||
  ""; // ← paste your CDN URL here if not using env var
// ───────────────────────────────────────────────────────────────────────────

async function run() {
  console.log("Starting: seed payment QR code URL into system_config\n");

  if (!QR_CODE_URL) {
    console.error(
      "ERROR: QR_CODE_URL is not set.\n" +
      "  Option 1 — env var:  QR_CODE_URL=\"https://...\" bun run seed:payment-qr\n" +
      "  Option 2 — edit the QR_CODE_URL constant in this script."
    );
    process.exit(1);
  }

  try {
    const result = await prisma.system_config.upsert({
      where: { key: "payment_qr_code" },
      update: {
        value: QR_CODE_URL,
        description: "Payment QR code image shown in the customer top-up flow",
      },
      create: {
        key: "payment_qr_code",
        value: QR_CODE_URL,
        description: "Payment QR code image shown in the customer top-up flow",
      },
    });

    const action = result.createdAt.getTime() === result.updatedAt.getTime()
      ? "Created"
      : "Updated";

    console.log(`✓ ${action} system_config[payment_qr_code]`);
    console.log(`  URL: ${result.value}`);
  } catch (err) {
    console.error("Failed:", err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
    console.log("\nDone.");
  }
}

run();
