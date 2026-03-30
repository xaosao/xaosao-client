import { prisma } from "./database.server";
import { createAuditLogs } from "./log.server";
import { FieldValidationError } from "./base.server";
import { notifyUser } from "./unified-notification.server";

// Get all active gifts for customer display
export async function getActiveGifts() {
  return prisma.gift.findMany({
    where: { status: "active" },
    orderBy: { sortOrder: "asc" },
    select: {
      id: true,
      name: true,
      image: true,
      price: true,
    },
  });
}

// Send a gift to a model's post
export async function sendGift(
  customerId: string,
  postId: string,
  giftId: string
) {
  const auditBase = {
    action: "SEND_GIFT",
    customer: customerId,
  };

  try {
    // Get the gift
    const gift = await prisma.gift.findFirst({
      where: { id: giftId, status: "active" },
    });

    if (!gift) {
      throw new FieldValidationError({
        success: false,
        error: true,
        message: "Gift not found or inactive!",
      });
    }

    // Get the post and verify it belongs to a model
    const post = await prisma.post.findUnique({
      where: { id: postId },
      select: { id: true, modelId: true, authorType: true },
    });

    if (!post || !post.modelId) {
      throw new FieldValidationError({
        success: false,
        error: true,
        message: "Post not found or not a model post!",
      });
    }

    const modelId = post.modelId;

    // Check customer wallet balance
    const customerWallet = await prisma.wallet.findFirst({
      where: { customerId, status: "active" },
      select: {
        id: true,
        totalBalance: true,
        totalSpend: true,
        totalRefunded: true,
      },
    });

    if (!customerWallet) {
      throw new FieldValidationError({
        success: false,
        error: true,
        message: "Wallet not found!",
      });
    }

    const availableBalance =
      (customerWallet.totalBalance || 0) -
      (customerWallet.totalSpend || 0) +
      (customerWallet.totalRefunded || 0);

    if (availableBalance < gift.price) {
      throw new FieldValidationError({
        success: false,
        error: true,
        message: "Insufficient wallet balance!",
      });
    }

    // Deduct from customer wallet
    await prisma.wallet.update({
      where: { id: customerWallet.id },
      data: {
        totalSpend: { increment: gift.price },
      },
    });

    // Create customer transaction (spending)
    const customerTransaction = await prisma.transaction_history.create({
      data: {
        identifier: "gift",
        amount: gift.price,
        paymentSlip: [],
        status: "approved",
        comission: 0,
        fee: 0,
        customerId,
        reason: `Gift "${gift.name}" sent to post`,
      },
    });

    // Top up model wallet
    const modelWallet = await prisma.wallet.findFirst({
      where: { modelId, status: "active" },
    });

    if (modelWallet) {
      await prisma.wallet.update({
        where: { id: modelWallet.id },
        data: {
          totalBalance: { increment: gift.price },
        },
      });

      // Create model transaction (earning)
      await prisma.transaction_history.create({
        data: {
          identifier: "gift_earning",
          amount: gift.price,
          paymentSlip: [],
          status: "approved",
          comission: 0,
          fee: 0,
          modelId,
          reason: `Gift "${gift.name}" received on post`,
        },
      });
    }

    // Create post_gift record
    const postGift = await prisma.post_gift.create({
      data: {
        postId,
        giftId,
        customerId,
        modelId,
        amount: gift.price,
      },
      include: {
        customer: { select: { id: true, firstName: true, lastName: true, profile: true } },
        gift: { select: { id: true, name: true, image: true, price: true } },
      },
    });

    await createAuditLogs({
      ...auditBase,
      description: `${customerId} sent gift "${gift.name}" (${gift.price} ₭) to post ${postId}`,
      status: "success",
      onSuccess: postGift,
    });

    // Get customer name for notification
    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
      select: { firstName: true, lastName: true },
    });
    const customerName = customer
      ? `${customer.firstName} ${customer.lastName || ""}`.trim()
      : "ລູກຄ້າ";

    // Notify model about the gift
    notifyUser({
      userType: "model",
      userId: modelId,
      notificationType: "gift_received",
      title: "ທ່ານໄດ້ຮັບຂອງຂວັນ!",
      message: `${customerName} ໄດ້ສົ່ງ "${gift.name}" ໃຫ້ໂພສຂອງທ່ານ.`,
      smsMessage: `XaoSao: ${customerName} ສົ່ງຂອງຂວັນ "${gift.name}" ໃຫ້ໂພສຂອງທ່ານ. ເປີດແອັບເພື່ອເບິ່ງ.`,
      data: { postId, giftId, customerId, postGiftId: postGift.id },
      url: `/model/posts/${postId}`,
    }).catch((err) =>
      console.error("[Gift] Failed to notify model:", err)
    );

    return { success: true, postGift };
  } catch (error: any) {
    console.error("SEND_GIFT_FAILED", error);
    await createAuditLogs({
      ...auditBase,
      description: `${customerId} - Send gift failed!`,
      status: "failed",
      onError: error,
    });

    if (error instanceof FieldValidationError) {
      throw error;
    }

    throw new FieldValidationError({
      success: false,
      error: true,
      message: "Failed to send gift!",
    });
  }
}

// Send a gift directly to a model (not tied to a post)
export async function sendDirectGift(
  customerId: string,
  modelId: string,
  giftId: string
) {
  const auditBase = {
    action: "SEND_DIRECT_GIFT",
    customer: customerId,
  };

  try {
    const gift = await prisma.gift.findFirst({
      where: { id: giftId, status: "active" },
    });

    if (!gift) {
      throw new FieldValidationError({
        success: false,
        error: true,
        message: "Gift not found or inactive!",
      });
    }

    // Verify model exists
    const model = await prisma.model.findUnique({
      where: { id: modelId },
      select: { id: true, firstName: true, lastName: true },
    });

    if (!model) {
      throw new FieldValidationError({
        success: false,
        error: true,
        message: "Model not found!",
      });
    }

    // Check customer wallet balance
    const customerWallet = await prisma.wallet.findFirst({
      where: { customerId, status: "active" },
      select: {
        id: true,
        totalBalance: true,
        totalSpend: true,
        totalRefunded: true,
      },
    });

    if (!customerWallet) {
      throw new FieldValidationError({
        success: false,
        error: true,
        message: "Wallet not found!",
      });
    }

    const availableBalance =
      (customerWallet.totalBalance || 0) -
      (customerWallet.totalSpend || 0) +
      (customerWallet.totalRefunded || 0);

    if (availableBalance < gift.price) {
      throw new FieldValidationError({
        success: false,
        error: true,
        message: "ຍອດເງິນບໍ່ພໍ! ກະລຸນາເຕີມເງິນກ່ອນ.",
      });
    }

    // Deduct from customer wallet
    await prisma.wallet.update({
      where: { id: customerWallet.id },
      data: { totalSpend: { increment: gift.price } },
    });

    // Create customer transaction (spending)
    await prisma.transaction_history.create({
      data: {
        identifier: "gift",
        amount: gift.price,
        paymentSlip: [],
        status: "approved",
        comission: 0,
        fee: 0,
        customerId,
        reason: `Gift "${gift.name}" sent directly to model`,
      },
    });

    // Top up model wallet
    const modelWallet = await prisma.wallet.findFirst({
      where: { modelId, status: "active" },
    });

    if (modelWallet) {
      await prisma.wallet.update({
        where: { id: modelWallet.id },
        data: { totalBalance: { increment: gift.price } },
      });

      await prisma.transaction_history.create({
        data: {
          identifier: "gift_earning",
          amount: gift.price,
          paymentSlip: [],
          status: "approved",
          comission: 0,
          fee: 0,
          modelId,
          reason: `Gift "${gift.name}" received directly from customer`,
        },
      });
    }

    // Create direct_gift record
    const directGift = await prisma.direct_gift.create({
      data: {
        giftId,
        customerId,
        modelId,
        amount: gift.price,
      },
    });

    await createAuditLogs({
      ...auditBase,
      description: `${customerId} sent direct gift "${gift.name}" (${gift.price} ₭) to model ${modelId}`,
      status: "success",
      onSuccess: directGift,
    });

    // Get customer name for notification
    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
      select: { firstName: true, lastName: true },
    });
    const customerName = customer
      ? `${customer.firstName} ${customer.lastName || ""}`.trim()
      : "ລູກຄ້າ";

    // Notify model
    notifyUser({
      userType: "model",
      userId: modelId,
      notificationType: "gift_received",
      title: "ທ່ານໄດ້ຮັບຂອງຂວັນ!",
      message: `${customerName} ໄດ້ສົ່ງ "${gift.name}" ໃຫ້ທ່ານ.`,
      smsMessage: `XaoSao: ${customerName} ສົ່ງຂອງຂວັນ "${gift.name}" ໃຫ້ທ່ານ. ເປີດແອັບເພື່ອເບິ່ງ.`,
      data: { giftId, customerId, directGiftId: directGift.id },
      url: `/model/dating`,
    }).catch((err) =>
      console.error("[DirectGift] Failed to notify model:", err)
    );

    return { success: true, directGift };
  } catch (error: any) {
    console.error("SEND_DIRECT_GIFT_FAILED", error);
    await createAuditLogs({
      ...auditBase,
      description: `${customerId} - Send direct gift failed!`,
      status: "failed",
      onError: error,
    });

    if (error instanceof FieldValidationError) {
      throw error;
    }

    throw new FieldValidationError({
      success: false,
      error: true,
      message: "Failed to send gift!",
    });
  }
}

// Get gifts sent to a specific post
export async function getPostGifts(postId: string) {
  return prisma.post_gift.findMany({
    where: { postId },
    orderBy: { createdAt: "desc" },
    include: {
      gift: {
        select: { id: true, name: true, image: true, price: true },
      },
      customer: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          profile: true,
          whatsapp: true,
          defaultLanguage: true,
        },
      },
    },
  });
}

// Get gift count summary for a post (grouped by gift type)
export async function getPostGiftSummary(postId: string) {
  const gifts = await prisma.post_gift.findMany({
    where: { postId },
    include: {
      gift: {
        select: { id: true, name: true, image: true, price: true },
      },
    },
  });

  // Group by gift type and count
  const summary: Record<string, { gift: any; count: number }> = {};
  for (const pg of gifts) {
    if (!summary[pg.giftId]) {
      summary[pg.giftId] = { gift: pg.gift, count: 0 };
    }
    summary[pg.giftId].count++;
  }

  return {
    totalGifts: gifts.length,
    giftSummary: Object.values(summary),
  };
}

// React to a gift (model only)
export async function reactToGift(
  postGiftId: string,
  modelId: string,
  reaction: string
) {
  const postGift = await prisma.post_gift.findUnique({
    where: { id: postGiftId },
    include: {
      gift: { select: { name: true } },
    },
  });

  if (!postGift || postGift.modelId !== modelId) {
    throw new FieldValidationError({
      success: false,
      error: true,
      message: "Gift not found or unauthorized!",
    });
  }

  const updated = await prisma.post_gift.update({
    where: { id: postGiftId },
    data: { reaction },
  });

  // Get model name for notification
  const model = await prisma.model.findUnique({
    where: { id: modelId },
    select: { firstName: true, lastName: true },
  });
  const modelName = model
    ? `${model.firstName} ${model.lastName || ""}`.trim()
    : "Model";

  const reactionEmoji = reaction === "love" ? "❤️" : reaction === "care" ? "🥰" : "🙏";
  const giftName = postGift.gift?.name || "gift";

  // Notify customer about the reaction (in-app only, no SMS)
  notifyUser({
    userType: "customer",
    userId: postGift.customerId,
    notificationType: "gift_reaction",
    title: `${modelName} ${reactionEmoji}`,
    message: `${modelName} ໄດ້ຕອບກັບຂອງຂວັນ "${giftName}" ຂອງທ່ານ.`,
    data: { postId: postGift.postId, postGiftId, modelId, reaction },
    url: `/customer/posts/${postGift.postId}`,
    skipSMS: true,
  }).catch((err) =>
    console.error("[Gift] Failed to notify customer reaction:", err)
  );

  return updated;
}
