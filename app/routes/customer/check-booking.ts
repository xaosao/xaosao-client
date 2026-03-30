import type { LoaderFunctionArgs } from "react-router";
import { requireUserSession } from "~/services/auths.server";

/**
 * Chat access check endpoint
 *
 * Logic:
 * 1. Has active booking with model → canChat
 * 2. Not subscribed → reason: "subscribe"
 * 3. Subscribed + < 2 unique models chatted today (non-VIP only) → canChat
 * 4. Subscribed + has gifted this model → canChat
 * 5. Otherwise → reason: "gift_required"
 */
export async function loader({ request }: LoaderFunctionArgs) {
  try {
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

    // Check if model is VIP (safe - defaults to false if field doesn't exist)
    let isVipModel = false;
    try {
      const model = await prisma.model.findUnique({
        where: { id: modelId },
        select: { vip: true },
      });
      isVipModel = model?.vip === true;
    } catch {
      // vip field may not exist yet in DB
    }

    // Get today's date in Laos timezone (UTC+7)
    const now = new Date();
    const laosOffset = 7 * 60 * 60 * 1000;
    const laosDate = new Date(now.getTime() + laosOffset);
    const todayStr = laosDate.toISOString().slice(0, 10);

    // 3. Check daily chat access (safe - table may not exist yet)
    try {
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

      // Count unique models chatted today
      const todayChats = await prisma.daily_chat_access.count({
        where: { customerId, date: todayStr },
      });

      // VIP models always require gift — no free chat slots
      if (!isVipModel && todayChats < 2) {
        await prisma.daily_chat_access.create({
          data: { customerId, modelId, date: todayStr },
        });

        return {
          canChat: true,
          reason: "daily_free",
          hasBooking: false,
          hasSubscription: true,
          dailyChatsUsed: todayChats + 1,
        };
      }

      // 4. Check if customer has sent a direct gift to this model (post gifts don't count)
      let hasGifted = false;

      try {
        const directGift = await prisma.direct_gift.findFirst({
          where: { customerId, modelId },
          select: { id: true },
        });
        hasGifted = !!directGift;
      } catch {
        // direct_gift table may not exist yet
      }

      if (hasGifted) {
        await prisma.daily_chat_access.create({
          data: { customerId, modelId, date: todayStr },
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
    } catch (e) {
      // daily_chat_access table may not exist yet — fallback to simple subscription check
      console.error("[check-booking] Daily chat access error, falling back:", e);
      return { canChat: true, reason: "subscription", hasBooking: false, hasSubscription: true };
    }
  } catch (e) {
    console.error("[check-booking] Error:", e);
    return { canChat: false, reason: "error" };
  }
}
