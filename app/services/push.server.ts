import webpush from "web-push";
import { prisma } from "./database.server";

// ========================================
// VAPID Configuration
// ========================================

// Initialize web-push with VAPID keys
// Generate keys with: npx web-push generate-vapid-keys
const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;
const VAPID_EMAIL = process.env.VAPID_EMAIL || "mailto:xaosao95@gmail.com";

// Only configure if keys are available
if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(VAPID_EMAIL, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
  console.log("[Push] Web Push configured with VAPID keys");
} else {
  console.warn("[Push] VAPID keys not configured. Push notifications disabled.");
}

// Export public key for client-side subscription
export function getVapidPublicKey(): string | null {
  return VAPID_PUBLIC_KEY || null;
}

// ========================================
// Subscription Management
// ========================================

interface PushSubscriptionData {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

/**
 * Save or update a push subscription for a user
 */
export async function savePushSubscription(
  subscription: PushSubscriptionData,
  userType: "customer" | "model",
  userId: string,
  userAgent?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Upsert subscription (update if endpoint exists, create if not)
    await prisma.push_subscription.upsert({
      where: { endpoint: subscription.endpoint },
      update: {
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
        userType,
        userId,
        userAgent: userAgent || null,
        updatedAt: new Date(),
      },
      create: {
        endpoint: subscription.endpoint,
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
        userType,
        userId,
        userAgent: userAgent || null,
      },
    });

    // Update user's sendPushNoti preference
    if (userType === "customer") {
      await prisma.customer.update({
        where: { id: userId },
        data: { sendPushNoti: true },
      });
    } else {
      await prisma.model.update({
        where: { id: userId },
        data: { sendPushNoti: true },
      });
    }

    console.log(`[Push] Subscription saved for ${userType}:${userId}`);
    return { success: true };
  } catch (error) {
    console.error("[Push] Error saving subscription:", error);
    return { success: false, error: "Failed to save subscription" };
  }
}

/**
 * Remove a push subscription
 */
export async function removePushSubscription(
  endpoint: string,
  userType: "customer" | "model",
  userId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    await prisma.push_subscription.deleteMany({
      where: {
        endpoint,
        userType,
        userId,
      },
    });

    // Check if user has any remaining subscriptions
    const remainingCount = await prisma.push_subscription.count({
      where: { userType, userId },
    });

    // If no subscriptions left, update user preference
    if (remainingCount === 0) {
      if (userType === "customer") {
        await prisma.customer.update({
          where: { id: userId },
          data: { sendPushNoti: false },
        });
      } else {
        await prisma.model.update({
          where: { id: userId },
          data: { sendPushNoti: false },
        });
      }
    }

    console.log(`[Push] Subscription removed for ${userType}:${userId}`);
    return { success: true };
  } catch (error) {
    console.error("[Push] Error removing subscription:", error);
    return { success: false, error: "Failed to remove subscription" };
  }
}

/**
 * Remove all subscriptions for a user
 */
export async function removeAllUserSubscriptions(
  userType: "customer" | "model",
  userId: string
): Promise<void> {
  try {
    await prisma.push_subscription.deleteMany({
      where: { userType, userId },
    });

    // Update user preference
    if (userType === "customer") {
      await prisma.customer.update({
        where: { id: userId },
        data: { sendPushNoti: false },
      });
    } else {
      await prisma.model.update({
        where: { id: userId },
        data: { sendPushNoti: false },
      });
    }

    console.log(`[Push] All subscriptions removed for ${userType}:${userId}`);
  } catch (error) {
    console.error("[Push] Error removing all subscriptions:", error);
  }
}

// ========================================
// Send Push Notifications
// ========================================

interface PushPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  image?: string;
  tag?: string;
  data?: Record<string, any>;
  actions?: Array<{
    action: string;
    title: string;
    icon?: string;
  }>;
}

/**
 * Send push notification to a specific user
 */
export async function sendPushToUser(
  userType: "customer" | "model",
  userId: string,
  payload: PushPayload
): Promise<{ sent: number; failed: number }> {
  console.log(`[Push] sendPushToUser called for ${userType}:${userId}`, payload.title);

  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    console.warn("[Push] VAPID keys not configured, skipping push");
    return { sent: 0, failed: 0 };
  }

  try {
    // Check if user has push notifications enabled
    let sendPushNoti = false;
    if (userType === "customer") {
      const customer = await prisma.customer.findUnique({
        where: { id: userId },
        select: { sendPushNoti: true },
      });
      sendPushNoti = customer?.sendPushNoti ?? false;
      console.log(`[Push] Customer ${userId} sendPushNoti:`, sendPushNoti);
    } else {
      const model = await prisma.model.findUnique({
        where: { id: userId },
        select: { sendPushNoti: true },
      });
      sendPushNoti = model?.sendPushNoti ?? false;
      console.log(`[Push] Model ${userId} sendPushNoti:`, sendPushNoti);
    }

    if (!sendPushNoti) {
      console.log(`[Push] User ${userType}:${userId} has push notifications disabled`);
      return { sent: 0, failed: 0 };
    }

    // Get all subscriptions for this user
    const subscriptions = await prisma.push_subscription.findMany({
      where: { userType, userId },
    });

    console.log(`[Push] Found ${subscriptions.length} subscriptions for ${userType}:${userId}`);

    if (subscriptions.length === 0) {
      console.log(`[Push] No subscriptions found for ${userType}:${userId}`);
      return { sent: 0, failed: 0 };
    }

    // Prepare notification payload
    const notificationPayload = JSON.stringify({
      title: payload.title,
      body: payload.body,
      icon: payload.icon || "/icons/icon-192x192.png",
      badge: payload.badge || "/icons/icon-72x72.png",
      image: payload.image,
      tag: payload.tag || `notification-${Date.now()}`,
      data: {
        ...payload.data,
        url: payload.data?.url || (userType === "customer" ? "/customer" : "/model"),
      },
      actions: payload.actions,
    });

    let sent = 0;
    let failed = 0;

    // Send to all user's devices
    for (const sub of subscriptions) {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: {
              p256dh: sub.p256dh,
              auth: sub.auth,
            },
          },
          notificationPayload
        );
        sent++;
      } catch (error: any) {
        failed++;
        console.error(`[Push] Failed to send to endpoint:`, error.statusCode || error.message);

        // Remove invalid subscriptions (410 Gone or 404 Not Found)
        if (error.statusCode === 410 || error.statusCode === 404) {
          await prisma.push_subscription.delete({
            where: { id: sub.id },
          }).catch(() => {});
          console.log(`[Push] Removed expired subscription: ${sub.id}`);
        }
      }
    }

    console.log(`[Push] Sent ${sent}/${subscriptions.length} notifications to ${userType}:${userId}`);
    return { sent, failed };
  } catch (error) {
    console.error("[Push] Error sending push notification:", error);
    return { sent: 0, failed: 0 };
  }
}

/**
 * Send push notification to a customer
 */
export async function sendPushToCustomer(
  customerId: string,
  payload: PushPayload
): Promise<void> {
  await sendPushToUser("customer", customerId, {
    ...payload,
    data: {
      ...payload.data,
      url: payload.data?.url || "/customer/notifications",
    },
  });
}

/**
 * Send push notification to a model
 */
export async function sendPushToModel(
  modelId: string,
  payload: PushPayload
): Promise<void> {
  await sendPushToUser("model", modelId, {
    ...payload,
    data: {
      ...payload.data,
      url: payload.data?.url || "/model/notifications",
    },
  });
}

// ========================================
// Booking Push Notification Helpers
// ========================================

/**
 * Send push notification for new booking request (to model)
 */
export async function pushBookingCreated(
  modelId: string,
  customerName: string,
  serviceName: string,
  bookingId: string
): Promise<void> {
  await sendPushToModel(modelId, {
    title: "New Booking Request",
    body: `${customerName} wants to book your "${serviceName}" service`,
    tag: `booking-${bookingId}`,
    data: {
      type: "booking_created",
      bookingId,
      url: "/model/dating",
    },
    actions: [
      { action: "view", title: "View" },
    ],
  });
}

/**
 * Send push notification when booking is confirmed (to customer)
 */
export async function pushBookingConfirmed(
  customerId: string,
  modelName: string,
  serviceName: string,
  bookingId: string
): Promise<void> {
  await sendPushToCustomer(customerId, {
    title: "Booking Confirmed!",
    body: `${modelName} has accepted your "${serviceName}" booking`,
    tag: `booking-${bookingId}`,
    data: {
      type: "booking_confirmed",
      bookingId,
      url: "/customer/dates-history",
    },
  });
}

/**
 * Send push notification when booking is rejected (to customer)
 */
export async function pushBookingRejected(
  customerId: string,
  modelName: string,
  serviceName: string,
  bookingId: string
): Promise<void> {
  await sendPushToCustomer(customerId, {
    title: "Booking Declined",
    body: `${modelName} couldn't accept your "${serviceName}" booking`,
    tag: `booking-${bookingId}`,
    data: {
      type: "booking_rejected",
      bookingId,
      url: "/customer/dates-history",
    },
  });
}

/**
 * Send push notification when booking is cancelled (to model)
 */
export async function pushBookingCancelled(
  modelId: string,
  customerName: string,
  serviceName: string,
  bookingId: string
): Promise<void> {
  await sendPushToModel(modelId, {
    title: "Booking Cancelled",
    body: `${customerName} cancelled the "${serviceName}" booking`,
    tag: `booking-${bookingId}`,
    data: {
      type: "booking_cancelled",
      bookingId,
      url: "/model/dating",
    },
  });
}

/**
 * Send push notification when service is completed (to customer)
 */
export async function pushBookingCompleted(
  customerId: string,
  modelName: string,
  serviceName: string,
  bookingId: string
): Promise<void> {
  await sendPushToCustomer(customerId, {
    title: "Service Completed",
    body: `${modelName} marked "${serviceName}" as complete. Please confirm.`,
    tag: `complete-${bookingId}`,
    data: {
      type: "booking_completed",
      bookingId,
      url: "/customer/dates-history",
    },
    actions: [
      { action: "confirm", title: "Confirm" },
      { action: "dispute", title: "Dispute" },
    ],
  });
}

/**
 * Send push notification when payment is released (to model)
 */
export async function pushPaymentReleased(
  modelId: string,
  amount: number,
  bookingId: string
): Promise<void> {
  await sendPushToModel(modelId, {
    title: "Payment Released!",
    body: `${amount.toLocaleString()} LAK has been added to your wallet`,
    tag: `payment-${bookingId}`,
    data: {
      type: "payment_released",
      bookingId,
      url: "/model/settings/wallet",
    },
  });
}

/**
 * Send push notification for new message
 */
export async function pushNewMessage(
  recipientType: "customer" | "model",
  recipientId: string,
  senderName: string,
  messagePreview: string,
  conversationId?: string
): Promise<void> {
  const payload: PushPayload = {
    title: "New Message",
    body: `${senderName}: ${messagePreview.substring(0, 100)}`,
    tag: `message-${conversationId || Date.now()}`,
    data: {
      type: "new_message",
      conversationId,
      url: recipientType === "customer" ? "/customer/realtime-chat" : "/model/realtime-chat",
    },
  };

  if (recipientType === "customer") {
    await sendPushToCustomer(recipientId, payload);
  } else {
    await sendPushToModel(recipientId, payload);
  }
}

/**
 * Send push notification for new match
 */
export async function pushNewMatch(
  modelId: string,
  customerId: string,
  modelName: string,
  customerName: string
): Promise<void> {
  // Notify model
  await sendPushToModel(modelId, {
    title: "New Match!",
    body: `You and ${customerName} have matched!`,
    tag: `match-${customerId}`,
    data: {
      type: "match_new",
      customerId,
      url: "/model/matches",
    },
  });

  // Notify customer
  await sendPushToCustomer(customerId, {
    title: "New Match!",
    body: `You and ${modelName} have matched!`,
    tag: `match-${modelId}`,
    data: {
      type: "match_new",
      modelId,
      url: "/customer/matches",
    },
  });
}

/**
 * Send push notification for deposit approved
 */
export async function pushDepositApproved(
  customerId: string,
  amount: number
): Promise<void> {
  await sendPushToCustomer(customerId, {
    title: "Deposit Approved!",
    body: `${amount.toLocaleString()} LAK has been added to your wallet`,
    tag: `deposit-${Date.now()}`,
    data: {
      type: "deposit_approved",
      url: "/customer/wallets",
    },
  });
}

/**
 * Send push notification for withdrawal approved
 */
export async function pushWithdrawApproved(
  modelId: string,
  amount: number
): Promise<void> {
  await sendPushToModel(modelId, {
    title: "Withdrawal Approved!",
    body: `${amount.toLocaleString()} LAK withdrawal has been processed`,
    tag: `withdraw-${Date.now()}`,
    data: {
      type: "withdraw_approved",
      url: "/model/settings/wallet",
    },
  });
}
