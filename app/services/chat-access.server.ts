/**
 * Website chat-access rules.
 *
 * xs_backend only checks for an active subscription before letting a customer
 * message a model. The website sells access on finer terms — active booking,
 * subscription tier, two free models per day, or a direct gift — so those
 * rules run here, in front, and the backend stays the backstop.
 *
 * Extracted from routes/customer/check-booking.ts so the chat "start" flow and
 * the existing WhatsApp buttons share one implementation. NOTE this is a
 * gate-and-consume: granting access on a free daily slot or a gift WRITES a
 * `daily_chat_access` row, so only call it when the user is actually opening
 * a chat.
 */

export type ChatAccessReason =
  | "booking"
  | "unlimited"
  | "daily_access"
  | "daily_free"
  | "gift_sent"
  | "subscription"
  | "subscribe"
  | "gift_required"
  | "invalid"
  | "error";

export interface ChatAccessResult {
  canChat: boolean;
  reason: ChatAccessReason;
  hasBooking?: boolean;
  hasSubscription?: boolean;
  unlimited?: boolean;
  dailyChatsUsed?: number;
  hasGiftedModel?: boolean;
}

export async function checkChatAccess(
  customerId: string,
  modelId: string | null
): Promise<ChatAccessResult> {
  try {
    const { prisma } = await import("~/services/database.server");

    if (!modelId) {
      return { canChat: false, reason: "invalid" };
    }

    // 1. An active booking always grants chat.
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

    // 2. No subscription — nothing else can grant access.
    const subscription = await prisma.subscription.findFirst({
      where: {
        customerId,
        status: "active",
        endDate: { gte: new Date() },
      },
      select: { id: true, plan: { select: { durationDays: true } } },
    });

    if (!subscription) {
      return {
        canChat: false,
        reason: "subscribe",
        hasBooking: false,
        hasSubscription: false,
      };
    }

    // Unlimited chat for 1-week+ subscribers (durationDays > 1). The 24h
    // package (durationDays === 1) still has the 2 free chat limit.
    const isUnlimited = (subscription.plan?.durationDays ?? 1) > 1;
    if (isUnlimited) {
      return {
        canChat: true,
        reason: "unlimited",
        hasBooking: false,
        hasSubscription: true,
        unlimited: true,
      };
    }

    // VIP models always require a gift — no free daily slots.
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

    // Today's date in Laos time (UTC+7).
    const laosDate = new Date(Date.now() + 7 * 60 * 60 * 1000);
    const todayStr = laosDate.toISOString().slice(0, 10);

    try {
      // 3. Already unlocked this model today.
      const existingAccess = await prisma.daily_chat_access.findUnique({
        where: {
          customerId_modelId_date: { customerId, modelId, date: todayStr },
        },
      });

      if (existingAccess) {
        return {
          canChat: true,
          reason: "daily_access",
          hasBooking: false,
          hasSubscription: true,
        };
      }

      const todayChats = await prisma.daily_chat_access.count({
        where: { customerId, date: todayStr },
      });

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

      // 4. A direct gift to this model unlocks it (post gifts don't count).
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

      // 5. Out of free slots and no gift — must send one.
      return {
        canChat: false,
        reason: "gift_required",
        hasBooking: false,
        hasSubscription: true,
        dailyChatsUsed: todayChats,
        hasGiftedModel: false,
      };
    } catch (e) {
      // daily_chat_access table may not exist yet — fall back to the plain
      // subscription check rather than locking everyone out.
      console.error("[chat-access] Daily chat access error, falling back:", e);
      return {
        canChat: true,
        reason: "subscription",
        hasBooking: false,
        hasSubscription: true,
      };
    }
  } catch (e) {
    console.error("[chat-access] Error:", e);
    return { canChat: false, reason: "error" };
  }
}
