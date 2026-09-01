/**
 * Website chat-access rule: an active subscription grants unlimited chat.
 *
 * This used to layer extra gates on top — two free models per day, a direct
 * gift to unlock anyone beyond that, VIP models always requiring a gift, and a
 * booking as a separate bypass. Those are gone: a subscriber can now message
 * anyone, as often as they like.
 *
 * Aligning on subscription-only also removes a mismatch that produced
 * confusing failures. xs_backend gates chat on `checkClientMembership`, i.e.
 * an active subscription and nothing else — so any customer the website let
 * through on a booking or a free daily slot, WITHOUT a subscription, was
 * rejected by the backend a moment later with "Your subscription has expired".
 * The two now agree.
 *
 * `daily_chat_access` rows are no longer written or read. Existing rows are
 * harmless; nothing consults them any more.
 */

export type ChatAccessReason =
  | "subscription"
  | "subscribe"
  | "invalid"
  | "error";

export interface ChatAccessResult {
  canChat: boolean;
  reason: ChatAccessReason;
  hasSubscription?: boolean;
  unlimited?: boolean;
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

    const subscription = await prisma.subscription.findFirst({
      where: {
        customerId,
        status: "active",
        endDate: { gte: new Date() },
      },
      select: { id: true },
    });

    if (!subscription) {
      return { canChat: false, reason: "subscribe", hasSubscription: false };
    }

    // Any active plan means unlimited chat — no per-day cap, no gift, and no
    // distinction between the 24-hour package and longer ones.
    return {
      canChat: true,
      reason: "subscription",
      hasSubscription: true,
      unlimited: true,
    };
  } catch (e) {
    console.error("[chat-access] Error:", e);
    return { canChat: false, reason: "error" };
  }
}
