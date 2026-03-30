import type { LoaderFunctionArgs } from "react-router";
import { requireUserSession } from "~/services/auths.server";

/**
 * Chat access check endpoint
 * Returns: { canChat, reason, hasBooking, hasSubscription, dailyChatsUsed, hasGiftedModel }
 *
 * Logic:
 * 1. Has active booking with model → canChat
 * 2. Not subscribed → reason: "subscribe"
 * 3. Subscribed + < 2 unique models chatted today → canChat (record access)
 * 4. Subscribed + >= 2 + has gifted this model → canChat
 * 5. Otherwise → reason: "gift_required"
 */
export async function loader({ request }: LoaderFunctionArgs) {
  const customerId = await requireUserSession(request);
  const { prisma } = await import("~/services/database.server");

  const url = new URL(request.url);
  const modelId = url.searchParams.get("modelId");

  if (!modelId) {
    return { canChat: false, reason: "invalid" };
  }

  // 1. Check if customer has active booking with this model
  const booking = await prisma.service_booking.findFirst({
    where: {
      customerId,
      modelId,
      status: { in: ["pending", "confirmed"] },
    },
    select: { id: true },
  });

  if (booking) {
    return { canChat: true, reason: "booking", hasBooking: true };
  }

  // 2. Check subscription
  const subscription = await prisma.subscription.findFirst({
    where: {
      customerId,
      status: "active",
      endDate: { gte: new Date() },
    },
    select: { id: true },
  });

  if (!subscription) {
    return { canChat: false, reason: "subscribe", hasBooking: false, hasSubscription: false };
  }

  // Check if model is VIP
  const model = await prisma.model.findUnique({
    where: { id: modelId },
    select: { vip: true },
  });
  const isVipModel = model?.vip === true;

  // Get today's date in Laos timezone (UTC+7)
  const now = new Date();
  const laosOffset = 7 * 60 * 60 * 1000;
  const laosDate = new Date(now.getTime() + laosOffset);
  const todayStr = laosDate.toISOString().slice(0, 10); // "2026-03-30"

  // 3. Check if already has access to this model today
  const existingAccess = await prisma.daily_chat_access.findUnique({
    where: {
      customerId_modelId_date: {
        customerId,
        modelId,
        date: todayStr,
      },
    },
  });

  if (existingAccess) {
    return { canChat: true, reason: "daily_access", hasBooking: false, hasSubscription: true };
  }

  // Count unique models chatted today (free slots)
  const todayChats = await prisma.daily_chat_access.count({
    where: {
      customerId,
      date: todayStr,
    },
  });

  // VIP models always require gift — no free chat slots
  if (!isVipModel && todayChats < 2) {
    // Has free slot — record access and allow
    await prisma.daily_chat_access.create({
      data: {
        customerId,
        modelId,
        date: todayStr,
      },
    });

    return {
      canChat: true,
      reason: "daily_free",
      hasBooking: false,
      hasSubscription: true,
      dailyChatsUsed: todayChats + 1,
    };
  }

  // 4. Check if customer has sent a direct gift to this model
  const directGift = await prisma.direct_gift.findFirst({
    where: { customerId, modelId },
    select: { id: true },
  });

  if (directGift) {
    // Gift was sent — record daily access and allow
    await prisma.daily_chat_access.create({
      data: {
        customerId,
        modelId,
        date: todayStr,
      },
    });

    return {
      canChat: true,
      reason: "gift_sent",
      hasBooking: false,
      hasSubscription: true,
      hasGiftedModel: true,
    };
  }

  // Also check post_gift (gift sent on model's post counts too)
  const postGift = await prisma.post_gift.findFirst({
    where: { customerId, modelId },
    select: { id: true },
  });

  if (postGift) {
    await prisma.daily_chat_access.create({
      data: {
        customerId,
        modelId,
        date: todayStr,
      },
    });

    return {
      canChat: true,
      reason: "gift_sent",
      hasBooking: false,
      hasSubscription: true,
      hasGiftedModel: true,
    };
  }

  // 5. Need to send gift first
  return {
    canChat: false,
    reason: "gift_required",
    hasBooking: false,
    hasSubscription: true,
    dailyChatsUsed: todayChats,
    hasGiftedModel: false,
  };
}
