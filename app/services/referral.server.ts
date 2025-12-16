import { prisma } from "./database.server";
import { createAuditLogs } from "./log.server";

// Referral reward amount in Kip
export const REFERRAL_REWARD_AMOUNT = 50000;

/**
 * Generate a unique referral code for a model
 * Format: XSR + last 6 characters of model ID (uppercase)
 */
export function generateReferralCode(modelId: string): string {
  const suffix = modelId.slice(-6).toUpperCase();
  return `XSR${suffix}`;
}

/**
 * Find the referrer model by referral code
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
 * Process referral reward when a referred model is approved
 * This should be called when admin approves a model
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

    // Check if reward was already paid
    if (approvedModel.referralRewardPaid) {
      console.log(`Referral reward skipped: Reward already paid for ${approvedModelId}`);
      return { success: false, reason: "Reward already paid" };
    }

    // Check if model is approved (active)
    if (approvedModel.status !== "active") {
      console.log(`Referral reward skipped: Model ${approvedModelId} is not active`);
      return { success: false, reason: "Model not active" };
    }

    // Get the referrer's wallet
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
      description: `Referral reward of ${REFERRAL_REWARD_AMOUNT} Kip paid to model ${approvedModel.referredById} for referring ${approvedModelId}`,
      status: "success",
      onSuccess: {
        referrerId: approvedModel.referredById,
        referredId: approvedModelId,
        amount: REFERRAL_REWARD_AMOUNT,
        transactionId: transaction.id,
        newBalance: updatedWallet.totalBalance,
      },
    });

    console.log(`Referral reward paid: ${REFERRAL_REWARD_AMOUNT} Kip to model ${approvedModel.referredById}`);

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
 */
export async function getReferralStats(modelId: string) {
  // Get or generate the model's referral code
  const model = await prisma.model.findUnique({
    where: { id: modelId },
    select: {
      id: true,
      referralCode: true,
      firstName: true,
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

  // Calculate statistics
  const totalReferred = referredModels.length;
  const approvedReferred = referredModels.filter(m => m.status === "active").length;
  const pendingReferred = referredModels.filter(m => m.status === "pending").length;
  const totalEarnings = referredModels.filter(m => m.referralRewardPaid).length * REFERRAL_REWARD_AMOUNT;

  const baseUrl = process.env.VITE_FRONTEND_URL || "http://localhost:3000/";

  return {
    referralCode,
    referralLink: `${baseUrl}model-auth/register?ref=${referralCode}`,
    stats: {
      totalReferred,
      approvedReferred,
      pendingReferred,
      totalEarnings,
    },
    referredModels: referredModels.map(m => ({
      id: m.id,
      firstName: m.firstName,
      username: m.username,
      profile: m.profile,
      status: m.status,
      createdAt: m.createdAt,
    })),
  };
}
