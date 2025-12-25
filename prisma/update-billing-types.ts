/**
 * Script to update service billing types
 * Run with: npx tsx prisma/update-billing-types.ts
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function updateBillingTypes() {
  console.log("Starting billing type updates...\n");

  try {
    // Update drinkingFriend to per_hour
    const drinkingFriend = await prisma.service.updateMany({
      where: { name: "drinkingFriend" },
      data: {
        billingType: "per_hour",
        hourlyRate: 50000, // Default hourly rate - adjust as needed
      },
    });
    console.log(`✅ drinkingFriend: Updated ${drinkingFriend.count} record(s) to per_hour`);

    // Update sleepPartner to per_session
    const sleepPartner = await prisma.service.updateMany({
      where: { name: "sleepPartner" },
      data: {
        billingType: "per_session",
        oneTimePrice: 100000,  // Default price for 1-2 hour session - adjust as needed
        oneNightPrice: 200000, // Default price for overnight - adjust as needed
      },
    });
    console.log(`✅ sleepPartner: Updated ${sleepPartner.count} record(s) to per_session`);

    // travelingFriend and hmongNewYear stay as per_day (default)
    const travelingFriend = await prisma.service.findFirst({
      where: { name: "travelingFriend" },
    });
    if (travelingFriend) {
      console.log(`✅ travelingFriend: Already set to per_day (default)`);
    }

    const hmongNewYear = await prisma.service.findFirst({
      where: { name: "hmongNewYear" },
    });
    if (hmongNewYear) {
      console.log(`✅ hmongNewYear: Already set to per_day (default)`);
    }

    // List all services with their billing types
    console.log("\n📋 Current service billing types:");
    const services = await prisma.service.findMany({
      select: {
        name: true,
        billingType: true,
        baseRate: true,
        hourlyRate: true,
        oneTimePrice: true,
        oneNightPrice: true,
      },
    });

    services.forEach((service) => {
      console.log(`   - ${service.name}:`);
      console.log(`     billingType: ${service.billingType}`);
      if (service.billingType === "per_day") {
        console.log(`     baseRate: ${service.baseRate?.toLocaleString()} LAK/day`);
      } else if (service.billingType === "per_hour") {
        console.log(`     hourlyRate: ${service.hourlyRate?.toLocaleString()} LAK/hour`);
      } else if (service.billingType === "per_session") {
        console.log(`     oneTimePrice: ${service.oneTimePrice?.toLocaleString()} LAK`);
        console.log(`     oneNightPrice: ${service.oneNightPrice?.toLocaleString()} LAK`);
      }
    });

    console.log("\n✨ Billing type updates completed successfully!");
  } catch (error) {
    console.error("❌ Error updating billing types:", error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

updateBillingTypes();
