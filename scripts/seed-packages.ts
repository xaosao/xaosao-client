/**
 * Seed script to create all subscription plans
 * Run with: npx tsx scripts/seed-packages.ts
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const features = [
  "Unlimited Profile Likes",
  "Smart Pass & Skip Option",
  "Advanced Partner Filtering Tools",
  "Private In-App Chat Access",
  "Easy Date Booking System",
  "Profile Boost & Spotlight",
  "Ad-Free User Experience",
  "Priority Customer Support",
];

const plans = [
  {
    name: "24-Hour Trial",
    description: "Try our service for 24 hours with unlimited chat and booking access",
    price: 10000,
    durationDays: 1,
    isPopular: false,
  },
  {
    name: "1 Week",
    description: "Full access for 1 week with all premium features",
    price: 50000,
    durationDays: 7,
    isPopular: true,
  },
  {
    name: "1 Month",
    description: "Best value monthly plan with all premium features",
    price: 150000,
    durationDays: 30,
    isPopular: false,
  },
  {
    name: "3 Months",
    description: "Maximum savings with our 3-month premium plan",
    price: 350000,
    durationDays: 90,
    isPopular: false,
  },
];

async function seedPackages() {
  console.log("Seeding subscription plans...\n");

  for (const plan of plans) {
    const existing = await prisma.subscription_plan.findFirst({
      where: { name: plan.name },
    });

    if (existing) {
      console.log(`  Already exists: ${plan.name} (${existing.id})`);
      continue;
    }

    const created = await prisma.subscription_plan.create({
      data: {
        name: plan.name,
        description: plan.description,
        price: plan.price,
        durationDays: plan.durationDays,
        features: Object.fromEntries(features.map((f, i) => [`feature_${i + 1}`, f])),
        status: "active",
        isPopular: plan.isPopular,
      },
    });

    console.log(`  Created: ${created.name} - ${created.price.toLocaleString()} KIP / ${created.durationDays} days (${created.id})`);
  }

  console.log("\nAll plans:");
  const all = await prisma.subscription_plan.findMany({ orderBy: { durationDays: "asc" } });
  all.forEach((p) => {
    console.log(`  - ${p.name}: ${p.price.toLocaleString()} KIP / ${p.durationDays} days [${p.status}]`);
  });

  console.log("\nDone!");
}

seedPackages()
  .catch((e) => {
    console.error("Error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
