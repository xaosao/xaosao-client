import { prisma } from "./database.server";
import { createAuditLogs } from "./log.server";

// Referral reward amount in Kip (for normal model type only)
export const REFERRAL_REWARD_AMOUNT = 50000;

// Minimum referred models required for commission eligibility
// Read from environment variable (dev: 2, production: 20)
export const MIN_REFERRED_MODELS_FOR_COMMISSION = parseInt(
  process.env.MIN_REFERRED_MODELS_FOR_COMMISSION || "2",
  10
);

// Minimum earnings required for partner-level commission
// Read from environment variable (dev: 100,000 Kip, production: 10,000,000 Kip)
export const MIN_EARNINGS_FOR_PARTNER_COMMISSION = parseInt(
  process.env.MIN_EARNINGS_FOR_PARTNER_COMMISSION || "100000",
  10
);

// Commission rates for booking referrals
export const BOOKING_COMMISSION_RATE_SPECIAL = 0.02; // 2% for special
export const BOOKING_COMMISSION_RATE_PARTNER = 0.04; // 4% for partner

// Commission rates for subscription referrals
export const SUBSCRIPTION_COMMISSION_RATE_SPECIAL = 0.20; // 20% for special
export const SUBSCRIPTION_COMMISSION_RATE_PARTNER = 0.40; // 40% for partner

/**
 * Generate a unique referral code for a model (for referring other models)
 * Format: XSR + last 6 characters of model ID (uppercase)
 */
export function generateReferralCode(modelId: string): string {
  const suffix = modelId.slice(-6).toUpperCase();
  return `XSR${suffix}`;
}

/**
 * Generate a unique customer referral code for a model (for referring customers)
 * Format: XSC + last 6 characters of model ID (uppercase)
 * Only for special/partner model types
 */
export function generateCustomerReferralCode(modelId: string): string {
  const suffix = modelId.slice(-6).toUpperCase();
  return `XSC${suffix}`;
}

/**
 * Find the referrer model by model referral code (XSR...)
 */
export async function findReferrerByCode(referralCode: string) {
  if (!referralCode) return null;

  const code = referralCode.toUpperCase().trim();

  // Find model with this referral code
  const referrer = await prisma.model.findFirst({
    where: {
      referralCode: code,
      status: "active", // Only active models can be referrers
    },
    select: {
      id: true,
      firstName: true,
      username: true,
      type: true,
    },
  });

  return referrer;
}

/**
 * Find the referrer model by customer referral code (XSC...)
 * All model types can refer customers
 */
export async function findReferrerByCustomerCode(customerReferralCode: string) {
  if (!customerReferralCode) return null;

  const code = customerReferralCode.toUpperCase().trim();

  // Find model with this customer referral code
  const referrer = await prisma.model.findFirst({
    where: {
      customerReferralCode: code,
      status: "active",
    },
    select: {
      id: true,
      firstName: true,
      username: true,
      type: true,
    },
  });

  return referrer;
}

/**
 * Ensure a model has a referral code (generate if missing)
 * Call this when a model is approved
 */
export async function ensureReferralCode(modelId: string): Promise<string> {
  const model = await prisma.model.findUnique({
    where: { id: modelId },
    select: { id: true, referralCode: true },
  });

  if (!model) {
    throw new Error("Model not found");
  }

  if (model.referralCode) {
    return model.referralCode;
  }

  // Generate and save referral code
  const referralCode = generateReferralCode(modelId);

  await prisma.model.update({
    where: { id: modelId },
    data: { referralCode },
  });

  return referralCode;
}

/**
 * Ensure a model has a customer referral code
 * Generate for all model types (normal, special, partner)
 */
export async function ensureCustomerReferralCode(modelId: string): Promise<string> {
  const model = await prisma.model.findUnique({
    where: { id: modelId },
    select: { id: true, customerReferralCode: true, type: true },
  });

  if (!model) {
    throw new Error("Model not found");
  }

  if (model.customerReferralCode) {
    return model.customerReferralCode;
  }

  // Generate and save customer referral code
  const customerReferralCode = generateCustomerReferralCode(modelId);

  await prisma.model.update({
    where: { id: modelId },
    data: { customerReferralCode },
  });

  return customerReferralCode;
}

/**
 * Check if a model meets commission eligibility conditions
 * Uses actual count of referred models from database (not cached field)
 */
export async function checkCommissionEligibility(modelId: string): Promise<{
  eligible: boolean;
  reason?: string;
  modelType: string;
  totalReferredModels: number;
  totalReferralEarnings: number;
}> {
  const model = await prisma.model.findUnique({
    where: { id: modelId },
    select: {
      type: true,
      totalReferralEarnings: true,
    },
  });

  if (!model) {
    return {
      eligible: false,
      reason: "Model not found",
      modelType: "normal",
      totalReferredModels: 0,
      totalReferralEarnings: 0,
    };
  }

  // Count actual referred models from database (more accurate than cached field)
  const actualReferredModelsCount = await prisma.model.count({
    where: {
      referredById: modelId,
      status: "active", // Only count approved models
    },
  });

  // Normal models don't earn percentage commissions (only flat 50K bonus)
  if (model.type === "normal") {
    return {
      eligible: false,
      reason: "Normal models earn flat bonus only",
      modelType: model.type,
      totalReferredModels: actualReferredModelsCount,
      totalReferralEarnings: model.totalReferralEarnings,
    };
  }

  // Check minimum referral count using actual count
  if (actualReferredModelsCount < MIN_REFERRED_MODELS_FOR_COMMISSION) {
    return {
      eligible: false,
      reason: `Need ${MIN_REFERRED_MODELS_FOR_COMMISSION} referred models (current: ${actualReferredModelsCount})`,
      modelType: model.type,
      totalReferredModels: actualReferredModelsCount,
      totalReferralEarnings: model.totalReferralEarnings,
    };
  }

  // For partner, also check minimum earnings
  if (model.type === "partner" && model.totalReferralEarnings < MIN_EARNINGS_FOR_PARTNER_COMMISSION) {
    return {
      eligible: false,
      reason: `Partner needs ${MIN_EARNINGS_FOR_PARTNER_COMMISSION.toLocaleString()} Kip earnings (current: ${model.totalReferralEarnings.toLocaleString()})`,
      modelType: model.type,
      totalReferredModels: actualReferredModelsCount,
      totalReferralEarnings: model.totalReferralEarnings,
    };
  }

  return {
    eligible: true,
    modelType: model.type,
    totalReferredModels: actualReferredModelsCount,
    totalReferralEarnings: model.totalReferralEarnings,
  };
}

/**
 * Process referral reward when a referred model is approved
 * This should be called when admin approves a model
 *
 * For "normal" type referrers: Pay 50,000 Kip flat bonus
 * For "special"/"partner" type referrers who are NOT commission-eligible: Pay 50,000 Kip flat bonus
 * For "special"/"partner" type referrers who ARE commission-eligible: No flat bonus (they earn % commissions instead)
 * Always increment the referrer's totalReferredModels count
 */
export async function processReferralReward(approvedModelId: string) {
  const auditBase = {
    action: "PROCESS_REFERRAL_REWARD",
    model: approvedModelId,
  };

  try {
    // Get the approved model with referral info
    const approvedModel = await prisma.model.findUnique({
      where: { id: approvedModelId },
      select: {
        id: true,
        firstName: true,
        referredById: true,
        referralRewardPaid: true,
        status: true,
      },
    });

    if (!approvedModel) {
      console.log(`Referral reward skipped: Model ${approvedModelId} not found`);
      return { success: false, reason: "Model not found" };
    }

    // Check if model was referred
    if (!approvedModel.referredById) {
      console.log(`Referral reward skipped: Model ${approvedModelId} has no referrer`);
      return { success: false, reason: "No referrer" };
    }

    // Check if reward was already paid/processed
    if (approvedModel.referralRewardPaid) {
      console.log(`Referral reward skipped: Already processed for ${approvedModelId}`);
      return { success: false, reason: "Already processed" };
    }

    // Check if model is approved (active)
    if (approvedModel.status !== "active") {
      console.log(`Referral reward skipped: Model ${approvedModelId} is not active`);
      return { success: false, reason: "Model not active" };
    }

    // Get the referrer model to check their type and eligibility
    const referrer = await prisma.model.findUnique({
      where: { id: approvedModel.referredById },
      select: {
        id: true,
        type: true,
        totalReferredModels: true,
        totalReferralEarnings: true,
      },
    });

    if (!referrer) {
      console.log(`Referral reward skipped: Referrer ${approvedModel.referredById} not found`);
      return { success: false, reason: "Referrer not found" };
    }

    // Always increment the referrer's totalReferredModels count
    const newTotalReferred = (referrer.totalReferredModels || 0) + 1;
    await prisma.model.update({
      where: { id: referrer.id },
      data: {
        totalReferredModels: newTotalReferred,
      },
    });

    // Check if special/partner is commission-eligible (meets all conditions)
    // If they are eligible, they earn % commissions instead of flat bonus
    const isSpecialOrPartner = referrer.type === "special" || referrer.type === "partner";
    let isCommissionEligible = false;

    if (isSpecialOrPartner) {
      // Check eligibility using the NEW total (after increment)
      const meetsModelRequirement = newTotalReferred >= MIN_REFERRED_MODELS_FOR_COMMISSION;
      const meetsEarningsRequirement = referrer.type === "partner"
        ? (referrer.totalReferralEarnings || 0) >= MIN_EARNINGS_FOR_PARTNER_COMMISSION
        : true; // Special only needs model count

      isCommissionEligible = meetsModelRequirement && meetsEarningsRequirement;
    }

    // For special/partner who ARE commission-eligible: no flat bonus (they earn % commissions)
    if (isSpecialOrPartner && isCommissionEligible) {
      // Mark as processed (no bonus paid, but counted)
      await prisma.model.update({
        where: { id: approvedModelId },
        data: { referralRewardPaid: true },
      });

      await createAuditLogs({
        ...auditBase,
        description: `Model referral tracked for ${referrer.type} referrer ${referrer.id}. No flat bonus (commission-eligible, earns % instead). Total referred: ${newTotalReferred}`,
        status: "success",
        onSuccess: {
          referrerId: referrer.id,
          referredId: approvedModelId,
          referrerType: referrer.type,
          newTotalReferred,
          commissionEligible: true,
        },
      });

      console.log(`Referral tracked for commission-eligible ${referrer.type} model ${referrer.id}. No flat bonus.`);

      return {
        success: true,
        referrerId: referrer.id,
        amount: 0,
        referrerType: referrer.type,
        message: "Referral counted (no flat bonus - commission-eligible, earns % instead)",
      };
    }

    // For "normal" type OR special/partner who are NOT commission-eligible: pay the flat 50,000 Kip bonus
    const referrerWallet = await prisma.wallet.findFirst({
      where: {
        modelId: approvedModel.referredById,
        status: "active",
      },
    });

    if (!referrerWallet) {
      console.log(`Referral reward skipped: Referrer ${approvedModel.referredById} has no wallet`);
      await createAuditLogs({
        ...auditBase,
        description: `Referral reward failed: Referrer ${approvedModel.referredById} has no active wallet`,
        status: "failed",
        onError: { reason: "Referrer wallet not found" },
      });
      return { success: false, reason: "Referrer wallet not found" };
    }

    // Update wallet balance and create transaction in a transaction
    const [updatedWallet, transaction, updatedModel] = await prisma.$transaction([
      // Add reward to referrer's wallet
      prisma.wallet.update({
        where: { id: referrerWallet.id },
        data: {
          totalBalance: referrerWallet.totalBalance + REFERRAL_REWARD_AMOUNT,
          totalRecharge: referrerWallet.totalRecharge + REFERRAL_REWARD_AMOUNT,
        },
      }),
      // Create transaction record
      prisma.transaction_history.create({
        data: {
          identifier: "referral",
          amount: REFERRAL_REWARD_AMOUNT,
          status: "approved",
          comission: 0,
          fee: 0,
          modelId: approvedModel.referredById,
          reason: `Referral reward for inviting ${approvedModel.firstName} (ID: ${approvedModelId})`,
        },
      }),
      // Mark reward as paid
      prisma.model.update({
        where: { id: approvedModelId },
        data: { referralRewardPaid: true },
      }),
    ]);

    await createAuditLogs({
      ...auditBase,
      description: `Referral reward of ${REFERRAL_REWARD_AMOUNT} Kip paid to ${referrer.type} model ${approvedModel.referredById} for referring ${approvedModelId}${isSpecialOrPartner ? ' (not commission-eligible yet)' : ''}`,
      status: "success",
      onSuccess: {
        referrerId: approvedModel.referredById,
        referredId: approvedModelId,
        referrerType: referrer.type,
        amount: REFERRAL_REWARD_AMOUNT,
        transactionId: transaction.id,
        newBalance: updatedWallet.totalBalance,
        commissionEligible: false,
      },
    });

    console.log(`Referral reward paid: ${REFERRAL_REWARD_AMOUNT} Kip to ${referrer.type} model ${approvedModel.referredById}`);

    return {
      success: true,
      referrerId: approvedModel.referredById,
      amount: REFERRAL_REWARD_AMOUNT,
      transactionId: transaction.id,
    };
  } catch (error) {
    console.error("Error processing referral reward:", error);
    await createAuditLogs({
      ...auditBase,
      description: `Referral reward processing failed for model ${approvedModelId}`,
      status: "failed",
      onError: error,
    });
    return { success: false, reason: "Processing error", error };
  }
}

/**
 * Get referral statistics for a model
 * Includes both model and customer referrals for special/partner types
 */
export async function getReferralStats(modelId: string) {
  // Get or generate the model's referral code
  const model = await prisma.model.findUnique({
    where: { id: modelId },
    select: {
      id: true,
      referralCode: true,
      customerReferralCode: true,
      firstName: true,
      type: true,
      totalReferredModels: true,
      totalReferredCustomers: true,
      totalReferralEarnings: true,
    },
  });

  if (!model) {
    throw new Error("Model not found");
  }

  // Ensure model has a referral code
  let referralCode = model.referralCode;
  if (!referralCode) {
    referralCode = await ensureReferralCode(modelId);
  }

  // Ensure model has a customer referral code (all model types can refer customers)
  let customerReferralCode = model.customerReferralCode;
  if (!customerReferralCode) {
    customerReferralCode = await ensureCustomerReferralCode(modelId);
  }

  // Get all models referred by this model
  const referredModels = await prisma.model.findMany({
    where: {
      referredById: modelId,
    },
    select: {
      id: true,
      firstName: true,
      username: true,
      profile: true,
      status: true,
      createdAt: true,
      referralRewardPaid: true,
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  // Get all customers referred by this model (for special/partner)
  const referredCustomers = await prisma.customer.findMany({
    where: {
      referredByModelId: modelId,
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      profile: true,
      status: true,
      createdAt: true,
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  // Calculate model referral statistics (use actual count from database)
  const totalReferredModels = referredModels.length;
  const approvedReferredModels = referredModels.filter(m => m.status === "active").length;
  const verifiedReferredModels = referredModels.filter(m => m.status === "verified").length;
  const pendingReferredModels = referredModels.filter(m => m.status === "pending").length;

  // Calculate customer referral statistics
  const totalReferredCustomers = referredCustomers.length;
  const activeReferredCustomers = referredCustomers.filter(c => c.status === "active").length;

  // Sync cached fields if they're out of sync (fix data inconsistency)
  if (model.totalReferredModels !== approvedReferredModels || model.totalReferredCustomers !== totalReferredCustomers) {
    await prisma.model.update({
      where: { id: modelId },
      data: {
        totalReferredModels: approvedReferredModels,
        totalReferredCustomers: totalReferredCustomers,
      },
    }).catch(err => console.error("Failed to sync referral counts:", err));
  }

  // Calculate referral reward earnings (50K per approved model)
  // This is the reward for referring models, separate from booking/subscription commissions
  // Count approved models (status = "active") that have been rewarded
  const paidReferralCount = referredModels.filter(m => m.referralRewardPaid).length;
  // For display, show potential earnings based on approved models
  const approvedModelCount = referredModels.filter(m => m.status === "active").length;

  // Calculate modelReferralEarnings with cap for special/partner models
  // - Normal models: earn 50K for ALL approved referrals (no cap)
  // - Special/Partner models: earn 50K only until they reach commission eligibility threshold
  //   After reaching threshold, they earn % commissions instead of flat 50K bonus
  let modelReferralEarnings: number;
  const isSpecialOrPartner = model.type === "special" || model.type === "partner";

  if (isSpecialOrPartner) {
    // Cap at commission threshold (e.g., 2 models in dev, 20 in prod)
    const cappedCount = Math.min(approvedModelCount, MIN_REFERRED_MODELS_FOR_COMMISSION);
    modelReferralEarnings = cappedCount * REFERRAL_REWARD_AMOUNT;
  } else {
    // Normal models: earn for all approved referrals
    modelReferralEarnings = approvedModelCount * REFERRAL_REWARD_AMOUNT;
  }

  // Get booking and subscription commission earnings from transactions
  const commissionTransactions = await prisma.transaction_history.findMany({
    where: {
      modelId: modelId,
      identifier: { in: ["booking_referral", "subscription_referral"] },
      status: "approved",
    },
    select: {
      identifier: true,
      amount: true,
    },
  });

  const bookingCommissionEarnings = commissionTransactions
    .filter(t => t.identifier === "booking_referral")
    .reduce((sum, t) => sum + t.amount, 0);

  const subscriptionCommissionEarnings = commissionTransactions
    .filter(t => t.identifier === "subscription_referral")
    .reduce((sum, t) => sum + t.amount, 0);

  const totalCommissionEarnings = bookingCommissionEarnings + subscriptionCommissionEarnings;
  const totalEarnings = modelReferralEarnings + totalCommissionEarnings;

  // Check commission eligibility
  const eligibility = await checkCommissionEligibility(modelId);

  const baseUrl = process.env.VITE_FRONTEND_URL || "http://localhost:3000/";

  return {
    modelType: model.type || "normal",
    referralCode,
    referralLink: `${baseUrl}model-auth/register?ref=${referralCode}`,
    // Customer referral link (only for special/partner)
    customerReferralCode: customerReferralCode || null,
    customerReferralLink: customerReferralCode
      ? `${baseUrl}register?ref=${customerReferralCode}`
      : null,
    // Commission eligibility
    commissionEligible: eligibility.eligible,
    commissionEligibilityReason: eligibility.reason,
    // Statistics
    stats: {
      // Model referrals
      totalReferredModels,
      approvedReferredModels,
      verifiedReferredModels,
      pendingReferredModels,
      // Customer referrals (special/partner only)
      totalReferredCustomers,
      activeReferredCustomers,
      // Earnings
      modelReferralEarnings,
      bookingCommissionEarnings,
      subscriptionCommissionEarnings,
      totalCommissionEarnings,
      totalEarnings,
      // Requirements for commission
      modelsNeededForCommission: Math.max(0, MIN_REFERRED_MODELS_FOR_COMMISSION - totalReferredModels),
      earningsNeededForPartner: model.type === "partner"
        ? Math.max(0, MIN_EARNINGS_FOR_PARTNER_COMMISSION - (model.totalReferralEarnings || 0))
        : 0,
    },
    referredModels: referredModels.map(m => ({
      id: m.id,
      firstName: m.firstName,
      username: m.username,
      profile: m.profile,
      status: m.status,
      createdAt: m.createdAt,
    })),
    referredCustomers: referredCustomers.map(c => ({
      id: c.id,
      firstName: c.firstName,
      lastName: c.lastName,
      profile: c.profile,
      status: c.status,
      createdAt: c.createdAt,
    })),
  };
}

/**
 * Process subscription commission for a model who referred the subscribing customer
 * Called when a customer pays for a subscription
 *
 * @param customerId - The customer who subscribed
 * @param subscriptionAmount - The subscription price paid
 * @param subscriptionPlanName - Name of the subscription plan
 */
export async function processSubscriptionReferralCommission(
  customerId: string,
  subscriptionAmount: number,
  subscriptionPlanName: string
) {
  const auditBase = {
    action: "SUBSCRIPTION_REFERRAL_COMMISSION",
    customer: customerId,
  };

  try {
    // Get the customer with their referrer info
    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
      select: {
        id: true,
        firstName: true,
        referredByModelId: true,
      },
    });

    if (!customer || !customer.referredByModelId) {
      // Customer was not referred by a model
      return { success: false, reason: "No referrer" };
    }

    // Check if referrer is eligible for commission
    const eligibility = await checkCommissionEligibility(customer.referredByModelId);

    if (!eligibility.eligible) {
      console.log(`Subscription commission skipped: ${eligibility.reason}`);
      return { success: false, reason: eligibility.reason };
    }

    // Get the referrer model
    const referrer = await prisma.model.findUnique({
      where: { id: customer.referredByModelId },
      select: {
        id: true,
        firstName: true,
        type: true,
        totalReferralEarnings: true,
      },
    });

    if (!referrer || (referrer.type !== "special" && referrer.type !== "partner")) {
      return { success: false, reason: "Referrer not eligible for subscription commission" };
    }

    // Calculate commission based on model type
    const commissionRate = referrer.type === "partner"
      ? SUBSCRIPTION_COMMISSION_RATE_PARTNER
      : SUBSCRIPTION_COMMISSION_RATE_SPECIAL;

    const commissionAmount = Math.floor(subscriptionAmount * commissionRate);

    if (commissionAmount <= 0) {
      return { success: false, reason: "Commission amount is zero" };
    }

    // Get the referrer's wallet
    const referrerWallet = await prisma.wallet.findFirst({
      where: {
        modelId: referrer.id,
        status: "active",
      },
    });

    if (!referrerWallet) {
      console.log(`Subscription commission skipped: Referrer ${referrer.id} has no wallet`);
      return { success: false, reason: "Referrer wallet not found" };
    }

    // Process commission payment in a transaction
    const [updatedWallet, transaction] = await prisma.$transaction([
      // Add commission to referrer's wallet (totalBalance = all approved earnings)
      prisma.wallet.update({
        where: { id: referrerWallet.id },
        data: {
          totalBalance: referrerWallet.totalBalance + commissionAmount,
        },
      }),
      // Create transaction record
      prisma.transaction_history.create({
        data: {
          identifier: "subscription_referral",
          amount: commissionAmount,
          status: "approved",
          comission: 0,
          fee: 0,
          modelId: referrer.id,
          reason: `${commissionRate * 100}% commission from ${customer.firstName}'s subscription (${subscriptionPlanName}: ${subscriptionAmount.toLocaleString()} Kip)`,
        },
      }),
    ]);

    // Update referrer's total referral earnings (for partner condition tracking)
    await prisma.model.update({
      where: { id: referrer.id },
      data: {
        totalReferralEarnings: (referrer.totalReferralEarnings || 0) + commissionAmount,
      },
    });

    await createAuditLogs({
      ...auditBase,
      description: `Subscription commission of ${commissionAmount.toLocaleString()} Kip (${commissionRate * 100}%) paid to ${referrer.type} model ${referrer.id} for customer ${customerId}'s subscription`,
      status: "success",
      onSuccess: {
        referrerId: referrer.id,
        referrerType: referrer.type,
        customerId: customerId,
        subscriptionAmount,
        commissionRate,
        commissionAmount,
        transactionId: transaction.id,
      },
    });

    console.log(`Subscription commission paid: ${commissionAmount.toLocaleString()} Kip to ${referrer.type} model ${referrer.id}`);

    return {
      success: true,
      referrerId: referrer.id,
      commissionAmount,
      commissionRate,
      transactionId: transaction.id,
    };
  } catch (error) {
    console.error("Error processing subscription referral commission:", error);
    await createAuditLogs({
      ...auditBase,
      description: `Subscription referral commission processing failed for customer ${customerId}`,
      status: "failed",
      onError: error,
    });
    return { success: false, reason: "Processing error", error };
  }
}

/**
 * Process booking commission for a model who referred the booked model
 * Called when a booking is completed and payment is released
 *
 * @param bookedModelId - The model who was booked
 * @param bookingPrice - The total booking price
 * @param bookingId - The booking ID for reference
 * @returns Commission processing result, including the adjusted system commission rate
 */
export async function processBookingReferralCommission(
  bookedModelId: string,
  bookingPrice: number,
  bookingId: string
) {
  const auditBase = {
    action: "BOOKING_REFERRAL_COMMISSION",
    model: bookedModelId,
  };

  try {
    // Get the booked model with their referrer info
    const bookedModel = await prisma.model.findUnique({
      where: { id: bookedModelId },
      select: {
        id: true,
        firstName: true,
        referredById: true,
      },
    });

    if (!bookedModel || !bookedModel.referredById) {
      // Model was not referred by another model
      return { success: false, reason: "No referrer", adjustedSystemRate: null };
    }

    // Check if referrer is eligible for commission
    const eligibility = await checkCommissionEligibility(bookedModel.referredById);

    if (!eligibility.eligible) {
      console.log(`Booking commission skipped: ${eligibility.reason}`);
      return { success: false, reason: eligibility.reason, adjustedSystemRate: null };
    }

    // Get the referrer model
    const referrer = await prisma.model.findUnique({
      where: { id: bookedModel.referredById },
      select: {
        id: true,
        firstName: true,
        type: true,
        totalReferralEarnings: true,
      },
    });

    if (!referrer || (referrer.type !== "special" && referrer.type !== "partner")) {
      return { success: false, reason: "Referrer not eligible for booking commission", adjustedSystemRate: null };
    }

    // Calculate commission based on model type
    const commissionRate = referrer.type === "partner"
      ? BOOKING_COMMISSION_RATE_PARTNER
      : BOOKING_COMMISSION_RATE_SPECIAL;

    const commissionAmount = Math.floor(bookingPrice * commissionRate);

    // Calculate adjusted system rate (10% total - referrer share)
    const adjustedSystemRate = referrer.type === "partner" ? 6 : 8; // Partner: 6%, Special: 8%

    if (commissionAmount <= 0) {
      return { success: false, reason: "Commission amount is zero", adjustedSystemRate };
    }

    // Get the referrer's wallet
    const referrerWallet = await prisma.wallet.findFirst({
      where: {
        modelId: referrer.id,
        status: "active",
      },
    });

    if (!referrerWallet) {
      console.log(`Booking commission skipped: Referrer ${referrer.id} has no wallet`);
      return { success: false, reason: "Referrer wallet not found", adjustedSystemRate };
    }

    // Process commission payment in a transaction
    const [updatedWallet, transaction] = await prisma.$transaction([
      // Add commission to referrer's wallet (totalBalance = all approved earnings)
      prisma.wallet.update({
        where: { id: referrerWallet.id },
        data: {
          totalBalance: referrerWallet.totalBalance + commissionAmount,
        },
      }),
      // Create transaction record
      prisma.transaction_history.create({
        data: {
          identifier: "booking_referral",
          amount: commissionAmount,
          status: "approved",
          comission: 0,
          fee: 0,
          modelId: referrer.id,
          reason: `${commissionRate * 100}% commission from ${bookedModel.firstName}'s booking #${bookingId} (${bookingPrice.toLocaleString()} Kip)`,
        },
      }),
    ]);

    // Update referrer's total referral earnings (for partner condition tracking)
    await prisma.model.update({
      where: { id: referrer.id },
      data: {
        totalReferralEarnings: (referrer.totalReferralEarnings || 0) + commissionAmount,
      },
    });

    await createAuditLogs({
      ...auditBase,
      description: `Booking commission of ${commissionAmount.toLocaleString()} Kip (${commissionRate * 100}%) paid to ${referrer.type} model ${referrer.id} for ${bookedModel.firstName}'s booking #${bookingId}`,
      status: "success",
      onSuccess: {
        referrerId: referrer.id,
        referrerType: referrer.type,
        bookedModelId: bookedModel.id,
        bookingId,
        bookingPrice,
        commissionRate,
        commissionAmount,
        adjustedSystemRate,
        transactionId: transaction.id,
      },
    });

    console.log(`Booking commission paid: ${commissionAmount.toLocaleString()} Kip to ${referrer.type} model ${referrer.id}`);

    return {
      success: true,
      referrerId: referrer.id,
      commissionAmount,
      commissionRate,
      adjustedSystemRate,
      transactionId: transaction.id,
    };
  } catch (error) {
    console.error("Error processing booking referral commission:", error);
    await createAuditLogs({
      ...auditBase,
      description: `Booking referral commission processing failed for model ${bookedModelId}`,
      status: "failed",
      onError: error,
    });
    return { success: false, reason: "Processing error", error, adjustedSystemRate: null };
  }
}
