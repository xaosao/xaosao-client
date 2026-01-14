/**
 * Script to add massage service to the database
 * Run with: npx tsx prisma/add-massage-service.ts
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function addMassageService() {
  console.log("Adding massage service...\n");

  try {
    // Check if massage service already exists
    const existingMassage = await prisma.service.findFirst({
      where: { name: "massage" },
    });

    if (existingMassage) {
      console.log("✅ Massage service already exists!");
      console.log(`   - ID: ${existingMassage.id}`);
      console.log(`   - Name: ${existingMassage.name}`);
      console.log(`   - Billing Type: ${existingMassage.billingType}`);
      console.log(`   - Base Rate: ${existingMassage.baseRate?.toLocaleString()} LAK/day`);
      console.log(`   - Hourly Rate: ${existingMassage.hourlyRate?.toLocaleString()} LAK/hour`);
      return;
    }

    // Get the current maximum order value to set the new service's order
    const maxOrderService = await prisma.service.findFirst({
      orderBy: { order: "desc" },
      select: { order: true },
    });
    const nextOrder = (maxOrderService?.order ?? 0) + 1;

    // Create new massage service
    const massage = await prisma.service.create({
      data: {
        name: "massage",
        description: "Professional massage services with various massage types available",
        baseRate: 50000, // Default base rate (not used for per_hour but required field)
        commission: 20,  // 20% commission
        order: nextOrder,
        status: "active",
        billingType: "per_hour",
        hourlyRate: 50000, // Default hourly rate (models will set custom rates via variants)
      },
    });

    console.log("✅ Massage service created successfully!");
    console.log(`   - ID: ${massage.id}`);
    console.log(`   - Name: ${massage.name}`);
    console.log(`   - Billing Type: ${massage.billingType}`);
    console.log(`   - Hourly Rate: ${massage.hourlyRate?.toLocaleString()} LAK/hour`);
    console.log(`   - Commission: ${massage.commission}%`);
    console.log(`   - Order: ${massage.order}`);

    // List all services
    console.log("\n📋 Current services:");
    const services = await prisma.service.findMany({
      orderBy: { order: "asc" },
      select: {
        name: true,
        billingType: true,
        status: true,
        order: true,
      },
    });

    services.forEach((service, index) => {
      console.log(`   ${index + 1}. ${service.name} (${service.billingType}) - Order: ${service.order} - Status: ${service.status}`);
    });

    console.log("\n✨ Massage service added successfully!");
  } catch (error) {
    console.error("❌ Error adding massage service:", error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

addMassageService();
