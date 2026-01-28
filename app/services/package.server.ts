import { prisma } from "./database.server";
import { createAuditLogs } from "./log.server";
import { FieldValidationError } from "./base.server";

// Check if customer has active subscription
export async function hasActiveSubscription(customerId: string) {
  try {
    const subscription = await prisma.subscription.findFirst({
      where: {
        customerId,
        status: "active",
        endDate: { gte: new Date() },
      },
    });

    return !!subscription;
  } catch (error) {
    console.error("CHECK_SUBSCRIPTION_FAILED", error);
    return false;
  }
}

// Check if customer has pending subscription
export async function hasPendingSubscription(customerId: string) {
  try {
    const subscription = await prisma.subscription.findFirst({
      where: {
        customerId,
        status: "pending_payment",
      },
    });

    return !!subscription;
  } catch (error) {
    console.error("CHECK_PENDING_SUBSCRIPTION_FAILED", error);
    return false;
  }
}

export async function getPackages(customerId: string) {
  try {
    const plans = await prisma.subscription_plan.findMany({
      where: { status: "active" },
      select: {
        id: true,
        name: true,
        description: true,
        price: true,
        durationDays: true,
        features: true,
        status: true,
        isPopular: true,
        createdAt: true,
        subscriptions: {
          where: {
            customerId,
            status: "active",
            endDate: { gte: new Date() },
          },
          select: {
            id: true,
          },
        },
      },
    });

    const result = plans.map((plan) => ({
      ...plan,
      current: plan.subscriptions.length > 0,
    }));

    return result;
  } catch (error) {
    console.error("GET_ALL_PACKAGES_FAILED", error);
    throw new Error("Failed to get all packages!");
  }
}

// Get customer subscription history with filters and pagination
export async function getSubscriptionHistory(
  customerId: string,
  page: number = 1,
  take: number = 10,
  status?: string,
  startDate?: string,
  endDate?: string
) {
  try {
    const skip = (page - 1) * take;

    // Build where clause
    const where: any = { customerId };

    if (status && status !== "all") {
      where.status = status;
    }

    if (startDate || endDate) {
      where.startDate = {};
      if (startDate) {
        where.startDate.gte = new Date(startDate);
      }
      if (endDate) {
        where.startDate.lte = new Date(endDate);
      }
    }

    // Get total count for pagination
    const total = await prisma.subscription_history.count({ where });

    // Get subscription history
    const history = await prisma.subscription_history.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take,
    });

    const pagination = {
      page,
      take,
      total,
      totalPages: Math.ceil(total / take),
    };

    return { history, pagination };
  } catch (error) {
    console.error("GET_SUBSCRIPTION_HISTORY_FAILED", error);
    throw new Error("Failed to get subscription history!");
  }
}

export async function getPackage(id: string, customerId: string) {
  try {
    const plan = await prisma.subscription_plan.findFirst({
      where: {
        id,
        status: "active",
      },
      select: {
        id: true,
        name: true,
        description: true,
        price: true,
        durationDays: true,
        features: true,
        status: true,
        isPopular: true,
        createdAt: true,
        subscriptions: {
          where: {
            customerId,
            status: "active",
            endDate: { gte: new Date() },
          },
          select: {
            id: true,
          },
        },
      },
    });

    if (!plan) {
      throw new Error("Plan not found or inactive");
    }

    const result = {
      ...plan,
      current: plan.subscriptions.length > 0,
    };

    return result;
  } catch (error) {
    console.error("GET_SINGLE_PACKAGE_FAILED", error);
    throw new Error("Failed to get single package!");
  }
}

export async function createSubscription(
  customerId: string,
  planId: string,
  amount: number,
  paymentSlip: string
) {
  const auditBase = {
    action: "CUSTOMER_SUBSCRIPTION",
    customer: customerId,
  };

  try {
    const transaction = await prisma.transaction_history.create({
      data: {
        identifier: "recharge",
        amount: amount,
        paymentSlip,
        status: "pending",
        comission: 0,
        fee: 0,
        customerId,
      },
    });

    const plan = await prisma.subscription_plan.findFirst({
      where: {
        id: planId,
      },
      select: {
        id: true,
        name: true,
        price: true,
        durationDays: true,
      },
    });

    if (!plan) {
      throw new FieldValidationError({
        success: false,
        error: true,
        message: "Failed to subscription!",
      });
    }

    if (transaction.id) {
      const startDate = new Date();
      const endDate = new Date(startDate);
      endDate.setDate(startDate.getDate() + plan.durationDays);

      const subscription = await prisma.subscription.create({
        data: {
          customerId,
          planId,
          startDate,
          endDate,
          status: "pending",
          autoRenew: true,
          paymentMethod: "manually",
          transactionId: transaction.id,
        },
      });

      if (subscription.id) {
        await prisma.subscription_history.create({
          data: {
            subscriptionId: subscription.id,
            customerId,
            planName: plan?.name,
            planPrice: plan?.price,
            durationDays: plan?.durationDays,
            startDate,
            endDate,
            paymentMethod: "manually",
            transactionId: transaction.id,
            status: "pending",
          },
        });
        return subscription;
      } else {
        throw new FieldValidationError({
          success: false,
          error: true,
          message: "Failed to subscription! No subscription",
        });
      }
    } else {
      throw new FieldValidationError({
        success: false,
        error: true,
        message: "Failed to subscription! No transaction",
      });
    }
  } catch (error: any) {
    console.error("SUBSCRIPTION_FAILED", error);
    await createAuditLogs({
      ...auditBase,
      description: `${customerId} - Customer subscription failed!`,
      status: "failed",
      onError: error,
    });
    throw new FieldValidationError({
      success: false,
      error: true,
      message: "Failed to subscription!",
    });
  }
}

// Create subscription using wallet balance
export async function createSubscriptionWithWallet(
  customerId: string,
  planId: string
) {
  const auditBase = {
    action: "CUSTOMER_SUBSCRIPTION_WALLET",
    customer: customerId,
  };

  try {
    const plan = await prisma.subscription_plan.findFirst({
      where: {
        id: planId,
        status: "active",
      },
      select: {
        id: true,
        name: true,
        price: true,
        durationDays: true,
      },
    });

    if (!plan) {
      throw new FieldValidationError({
        success: false,
        error: true,
        message: "Plan not found or inactive!",
      });
    }

    // Check for existing subscription (any status)
    const existingSubscription = await prisma.subscription.findFirst({
      where: {
        customerId,
      },
      include: {
        plan: {
          select: {
            name: true,
            price: true,
            durationDays: true,
          },
        },
      },
    });

    let remainingDays = 0;
    let oldSubscriptionName = "";
    let isUpgrade = false;

    // If there's an active subscription, calculate remaining days
    if (existingSubscription && existingSubscription.status === "active") {
      const now = new Date();
      const endDate = new Date(existingSubscription.endDate);
      const timeDiff = endDate.getTime() - now.getTime();
      remainingDays = Math.max(0, Math.ceil(timeDiff / (1000 * 3600 * 24)));
      oldSubscriptionName = existingSubscription.plan.name;
      isUpgrade = true;

      // Calculate original duration in days for history
      const originalDuration = Math.ceil(
        (new Date(existingSubscription.endDate).getTime() -
         new Date(existingSubscription.startDate).getTime()) /
        (1000 * 3600 * 24)
      );

      // Create history record for the old subscription before updating
      await prisma.subscription_history.create({
        data: {
          subscriptionId: existingSubscription.id,
          customerId,
          planName: existingSubscription.plan.name,
          planPrice: existingSubscription.plan.price,
          durationDays: originalDuration,
          startDate: existingSubscription.startDate,
          endDate: existingSubscription.endDate,
          paymentMethod: existingSubscription.paymentMethod || "wallet",
          transactionId: existingSubscription.transactionId,
          status: "upgraded",
        },
      });
    }

    // Import deductFromWallet function
    const { deductFromWallet } = await import("./wallet.server");

    // Deduct from wallet and create transaction
    const { transaction } = await deductFromWallet(
      customerId,
      plan.price,
      plan.id,
      plan.name
    );

    const startDate = new Date();
    const endDate = new Date(startDate);
    // Add new plan duration + remaining days from old subscription
    const totalDays = plan.durationDays + remainingDays;
    endDate.setDate(startDate.getDate() + totalDays);

    let subscription;

    if (existingSubscription) {
      // Update existing subscription record
      subscription = await prisma.subscription.update({
        where: { id: existingSubscription.id },
        data: {
          planId,
          startDate,
          endDate,
          status: "active",
          autoRenew: true,
          paymentMethod: "wallet",
          transactionId: transaction.id,
          notes: remainingDays > 0
            ? `Upgraded from ${oldSubscriptionName}. ${remainingDays} days carried over from previous subscription.`
            : "New subscription activated",
        },
      });
    } else {
      // Create new subscription record (first time)
      subscription = await prisma.subscription.create({
        data: {
          customerId,
          planId,
          startDate,
          endDate,
          status: "active",
          autoRenew: true,
          paymentMethod: "wallet",
          transactionId: transaction.id,
          notes: "Initial subscription",
        },
      });
    }

    // Create subscription history for the new/updated subscription
    await prisma.subscription_history.create({
      data: {
        subscriptionId: subscription.id,
        customerId,
        planName: plan.name,
        planPrice: plan.price,
        durationDays: totalDays,
        startDate,
        endDate,
        paymentMethod: "wallet",
        transactionId: transaction.id,
        status: "active",
      },
    });

    await createAuditLogs({
      ...auditBase,
      description: isUpgrade
        ? `${customerId} - Upgraded subscription from ${oldSubscriptionName} to ${plan.name}. ${remainingDays} days transferred. Total duration: ${totalDays} days.`
        : `${customerId} - Subscription created successfully via wallet`,
      status: "success",
      onSuccess: subscription,
    });

    return subscription;
  } catch (error: any) {
    console.error("SUBSCRIPTION_WITH_WALLET_FAILED", error);
    await createAuditLogs({
      ...auditBase,
      description: `${customerId} - Customer subscription via wallet failed!`,
      status: "failed",
      onError: error,
    });

    // Re-throw FieldValidationError as-is
    if (error instanceof FieldValidationError) {
      throw error;
    }

    throw new FieldValidationError({
      success: false,
      error: true,
      message: "Failed to create subscription with wallet!",
    });
  }
}

// Create pending subscription linked to existing transaction
export async function createPendingSubscription(
  customerId: string,
  planId: string,
  transactionId: string
) {
  const auditBase = {
    action: "CUSTOMER_PENDING_SUBSCRIPTION",
    customer: customerId,
  };

  try {
    // Check if there's already a pending subscription
    const existingPending = await prisma.subscription.findFirst({
      where: {
        customerId,
        status: "pending_payment",
      },
    });

    if (existingPending) {
      throw new FieldValidationError({
        success: false,
        error: true,
        message: "You already have a pending subscription. Please wait for admin approval.",
      });
    }

    const plan = await prisma.subscription_plan.findFirst({
      where: {
        id: planId,
        status: "active",
      },
      select: {
        id: true,
        name: true,
        price: true,
        durationDays: true,
      },
    });

    if (!plan) {
      throw new FieldValidationError({
        success: false,
        error: true,
        message: "Plan not found or inactive!",
      });
    }

    const startDate = new Date();
    const endDate = new Date(startDate);
    endDate.setDate(startDate.getDate() + plan.durationDays);

    const subscription = await prisma.subscription.create({
      data: {
        customerId,
        planId,
        startDate,
        endDate,
        status: "pending_payment",
        autoRenew: true,
        paymentMethod: "manually",
        transactionId,
        notes: "Waiting for admin approval",
      },
    });

    await prisma.subscription_history.create({
      data: {
        subscriptionId: subscription.id,
        customerId,
        planName: plan.name,
        planPrice: plan.price,
        durationDays: plan.durationDays,
        startDate,
        endDate,
        paymentMethod: "manually",
        transactionId,
        status: "pending_payment",
      },
    });

    await createAuditLogs({
      ...auditBase,
      description: `${customerId} - Pending subscription created, waiting for admin approval`,
      status: "success",
      onSuccess: subscription,
    });

    return subscription;
  } catch (error: any) {
    console.error("CREATE_PENDING_SUBSCRIPTION_FAILED", error);
    await createAuditLogs({
      ...auditBase,
      description: `${customerId} - Failed to create pending subscription!`,
      status: "failed",
      onError: error,
    });

    // Re-throw FieldValidationError as-is
    if (error instanceof FieldValidationError) {
      throw error;
    }

    throw new FieldValidationError({
      success: false,
      error: true,
      message: "Failed to create pending subscription!",
    });
  }
}
