import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding 24-hour trial package...");

  // Check if 24-hour trial package already exists
  const existingPlan = await prisma.subscription_plan.findFirst({
    where: { name: "24-Hour Trial" },
  });

  if (existingPlan) {
    console.log("✅ 24-Hour Trial package already exists:", existingPlan.id);
    return;
  }

  // Create 24-hour trial package
  const trialPlan = await prisma.subscription_plan.create({
    data: {
      name: "24-Hour Trial",
      description: "Try our service for 24 hours with unlimited chat and booking access",
      price: 10000, // 10,000 KIP
      durationDays: 1, // 24 hours = 1 day
      features: {
        chat: "Unlimited chat with models",
        booking: "Unlimited booking requests",
        support: "24/7 customer support",
      },
      status: "active",
      isPopular: true, // Show prominently in packages page
    },
  });

  console.log("✅ 24-Hour Trial package created successfully!");
  console.log("   ID:", trialPlan.id);
  console.log("   Name:", trialPlan.name);
  console.log("   Price:", trialPlan.price, "KIP");
  console.log("   Duration:", trialPlan.durationDays, "day(s)");
}

main()
  .catch((e) => {
    console.error("❌ Error seeding trial package:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
