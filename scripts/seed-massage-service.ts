/**
 * Seed script to add massage service
 * Run with: npx tsx scripts/seed-massage-service.ts
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // Check if massage service already exists
  const existing = await prisma.service.findUnique({
    where: { name: "massage" },
  });

  if (existing) {
    console.log("Massage service already exists:", existing.id);
    return;
  }

  // Get the highest order value
  const lastService = await prisma.service.findFirst({
    orderBy: { order: "desc" },
    select: { order: true },
  });

  const newOrder = (lastService?.order ?? 0) + 1;

  const service = await prisma.service.create({
    data: {
      name: "massage",
      description: "Professional massage services",
      baseRate: 0,
      commission: 20,
      order: newOrder,
      billingType: "per_hour",
      status: "active",
    },
  });

  console.log("Massage service created:", service.id, "order:", service.order);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
