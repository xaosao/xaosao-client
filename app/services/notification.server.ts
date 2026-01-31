import { prisma } from "./database.server";
import { EventEmitter } from "events";
import Telbiz from "telbiz";
import {
  pushBookingCreated,
  pushBookingConfirmed,
  pushBookingRejected,
  pushBookingCancelled,
  pushBookingCompleted,
  pushPaymentReleased,
  pushNewMatch,
  pushNewMessage,
  pushDepositApproved,
  pushWithdrawApproved,
  sendPushToModel,
  sendPushToCustomer,
} from "./push.server";

// ========================================
// SMS Configuration
// ========================================

// Initialize Telbiz SMS client
const tb = new Telbiz(
  process.env.TELBIZ_CLIENT_ID as string,
  process.env.TELBIZ_SECRETKEY as string
);

/**
 * Format phone number for Telbiz (expects 20xxxxxxxx or 30xxxxxxx format)
 */
function formatPhoneNumber(phone: string | number | null): string | null {
  if (!phone) return null;

  let formattedPhone = phone.toString();

  // Remove country code 856 if present
  if (formattedPhone.startsWith("856")) {
    formattedPhone = formattedPhone.substring(3);
  }

  // Remove leading zeros
  formattedPhone = formattedPhone.replace(/^0+/, "");

  // Validate format: should be 10 digits starting with 20 or 30
  if (!formattedPhone.match(/^(20|30)\d{8}$/)) {
    console.warn(`Invalid phone number format: ${formattedPhone}`);
    return null;
  }

  return formattedPhone;
}

/**
 * Send SMS to a phone number
 */
async function sendSMS(phone: string | number | null, message: string): Promise<boolean> {
  try {
    if (!process.env.TELBIZ_CLIENT_ID || !process.env.TELBIZ_SECRETKEY) {
      console.warn("Telbiz credentials not configured. SMS not sent.");
      return false;
    }

    const formattedPhone = formatPhoneNumber(phone);
    if (!formattedPhone) {
      console.warn("Invalid phone number, SMS not sent.");
      return false;
    }

    await tb.SendSMSAsync("OTP", formattedPhone, message);
    console.log(`SMS sent to ${formattedPhone}`);
    return true;
  } catch (error) {
    console.error("SEND_SMS_FAILED", error);
    return false;
  }
}

/**
 * Get model's WhatsApp number and SMS preference
 */
async function getModelSMSInfo(modelId: string): Promise<{ phone: number | null; sendSMSNoti: boolean }> {
  try {
    const model = await prisma.model.findUnique({
      where: { id: modelId },
      select: { whatsapp: true, sendSMSNoti: true },
    });
    return {
      phone: model?.whatsapp || null,
      sendSMSNoti: model?.sendSMSNoti ?? true, // Default to true if not set
    };
  } catch {
    return { phone: null, sendSMSNoti: false };
  }
}

/**
 * Get customer's WhatsApp number and SMS preference
 */
async function getCustomerSMSInfo(customerId: string): Promise<{ phone: number | null; sendSMSNoti: boolean }> {
  try {
    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
      select: { whatsapp: true, sendSMSNoti: true },
    });
    return {
      phone: customer?.whatsapp || null,
      sendSMSNoti: customer?.sendSMSNoti ?? true, // Default to true if not set
    };
  } catch {
    return { phone: null, sendSMSNoti: false };
  }
}

/**
 * Send SMS to model (only if SMS notifications are enabled)
 */
async function sendSMSToModel(modelId: string, message: string): Promise<void> {
  const { phone, sendSMSNoti } = await getModelSMSInfo(modelId);

  if (!sendSMSNoti) {
    console.log(`[SMS] Model ${modelId} has SMS notifications disabled, skipping`);
    return;
  }

  if (phone) {
    sendSMS(phone, message).catch((err) =>
      console.error("Failed to send SMS to model:", err)
    );
  }
}

/**
 * Send SMS to customer (only if SMS notifications are enabled)
 */
async function sendSMSToCustomer(customerId: string, message: string): Promise<void> {
  const { phone, sendSMSNoti } = await getCustomerSMSInfo(customerId);

  if (!sendSMSNoti) {
    console.log(`[SMS] Customer ${customerId} has SMS notifications disabled, skipping`);
    return;
  }

  if (phone) {
    sendSMS(phone, message).catch((err) =>
      console.error("Failed to send SMS to customer:", err)
    );
  }
}

// ========================================
// Notification Types
// ========================================

export type NotificationType =
  // Booking notifications
  | "booking_created"
  | "booking_confirmed"
  | "booking_rejected"
  | "booking_cancelled"
  | "booking_checkin_model"
  | "booking_checkin_customer"
  | "booking_completed"
  | "booking_confirmed_completion"
  | "booking_disputed"
  | "payment_released"
  | "payment_refunded"
  // Social/Matching notifications
  | "like_received"
  | "match_new"
  | "friend_request"
  | "friend_accepted"
  // Chat notifications
  | "new_message"
  // Profile notifications
  | "profile_viewed"
  | "profile_approved"
  | "profile_verified"
  // Transaction notifications
  | "deposit_approved"
  | "deposit_rejected"
  | "withdraw_approved"
  | "withdraw_rejected"
  // System notifications
  | "welcome"
  // Call notifications
  | "incoming_call"
  | "call_missed"
  | "call_ended";

interface NotificationPayload {
  type: NotificationType;
  title: string;
  message: string;
  data?: Record<string, any>;
}

// ========================================
// Real-time Event Emitter (SSE)
// ========================================

// Global event emitter for SSE notifications
declare global {
  var __notificationEmitter: EventEmitter | undefined;
}

let notificationEmitter: EventEmitter;

if (process.env.NODE_ENV === "production") {
  notificationEmitter = new EventEmitter();
  notificationEmitter.setMaxListeners(1000);
} else {
  if (!global.__notificationEmitter) {
    global.__notificationEmitter = new EventEmitter();
    global.__notificationEmitter.setMaxListeners(1000);
  }
  notificationEmitter = global.__notificationEmitter;
}

export { notificationEmitter };

// Event channel names
export function getModelChannel(modelId: string) {
  return `model:${modelId}`;
}

export function getCustomerChannel(customerId: string) {
  return `customer:${customerId}`;
}

// ========================================
// Create Notification Functions
// ========================================

/**
 * Create a notification for a model and emit real-time event
 */
export async function createModelNotification(
  modelId: string,
  payload: NotificationPayload
) {
  try {
    const notification = await prisma.model_notification.create({
      data: {
        type: payload.type,
        title: payload.title,
        message: payload.message,
        data: payload.data || {},
        isRead: false,
        modelId,
      },
    });

    const channel = getModelChannel(modelId);
    const listenerCount = notificationEmitter.listenerCount(channel);
    console.log(`[Notification] Emitting ${payload.type} to ${channel}, listeners: ${listenerCount}`);

    // Emit real-time event
    notificationEmitter.emit(channel, {
      id: notification.id,
      type: payload.type,
      title: payload.title,
      message: payload.message,
      data: payload.data,
      createdAt: notification.createdAt,
    });

    return notification;
  } catch (error) {
    console.error("CREATE_MODEL_NOTIFICATION_FAILED", error);
    throw error;
  }
}

/**
 * Create a notification for a customer and emit real-time event
 */
export async function createCustomerNotification(
  customerId: string,
  payload: NotificationPayload
) {
  try {
    const notification = await prisma.customer_notification.create({
      data: {
        type: payload.type,
        title: payload.title,
        message: payload.message,
        data: payload.data || {},
        isRead: false,
        customerId,
      },
    });

    // Emit real-time event
    notificationEmitter.emit(getCustomerChannel(customerId), {
      id: notification.id,
      type: payload.type,
      title: payload.title,
      message: payload.message,
      data: payload.data,
      createdAt: notification.createdAt,
    });

    return notification;
  } catch (error) {
    console.error("CREATE_CUSTOMER_NOTIFICATION_FAILED", error);
    throw error;
  }
}

// ========================================
// Get Notification Functions
// ========================================

/**
 * Get all notifications for a model
 */
export async function getModelNotifications(
  modelId: string,
  options?: { limit?: number; unreadOnly?: boolean }
) {
  const { limit = 50, unreadOnly = false } = options || {};

  try {
    return await prisma.model_notification.findMany({
      where: {
        modelId,
        ...(unreadOnly ? { isRead: false } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
  } catch (error) {
    console.error("GET_MODEL_NOTIFICATIONS_FAILED", error);
    throw error;
  }
}

/**
 * Get all notifications for a customer
 */
export async function getCustomerNotifications(
  customerId: string,
  options?: { limit?: number; unreadOnly?: boolean }
) {
  const { limit = 50, unreadOnly = false } = options || {};

  try {
    return await prisma.customer_notification.findMany({
      where: {
        customerId,
        ...(unreadOnly ? { isRead: false } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
  } catch (error) {
    console.error("GET_CUSTOMER_NOTIFICATIONS_FAILED", error);
    throw error;
  }
}

/**
 * Get unread notification count for a model
 */
export async function getModelUnreadCount(modelId: string) {
  try {
    return await prisma.model_notification.count({
      where: {
        modelId,
        isRead: false,
      },
    });
  } catch (error) {
    console.error("GET_MODEL_UNREAD_COUNT_FAILED", error);
    return 0;
  }
}

/**
 * Get unread notification count for a customer
 */
export async function getCustomerUnreadCount(customerId: string) {
  try {
    return await prisma.customer_notification.count({
      where: {
        customerId,
        isRead: false,
      },
    });
  } catch (error) {
    console.error("GET_CUSTOMER_UNREAD_COUNT_FAILED", error);
    return 0;
  }
}

// ========================================
// Mark as Read Functions
// ========================================

/**
 * Mark a single model notification as read
 */
export async function markModelNotificationAsRead(
  notificationId: string,
  modelId: string
) {
  try {
    return await prisma.model_notification.update({
      where: {
        id: notificationId,
        modelId,
      },
      data: { isRead: true },
    });
  } catch (error) {
    console.error("MARK_MODEL_NOTIFICATION_READ_FAILED", error);
    throw error;
  }
}

/**
 * Mark a single customer notification as read
 */
export async function markCustomerNotificationAsRead(
  notificationId: string,
  customerId: string
) {
  try {
    return await prisma.customer_notification.update({
      where: {
        id: notificationId,
        customerId,
      },
      data: { isRead: true },
    });
  } catch (error) {
    console.error("MARK_CUSTOMER_NOTIFICATION_READ_FAILED", error);
    throw error;
  }
}

/**
 * Mark all model notifications as read
 */
export async function markAllModelNotificationsAsRead(modelId: string) {
  try {
    return await prisma.model_notification.updateMany({
      where: {
        modelId,
        isRead: false,
      },
      data: { isRead: true },
    });
  } catch (error) {
    console.error("MARK_ALL_MODEL_NOTIFICATIONS_READ_FAILED", error);
    throw error;
  }
}

/**
 * Mark all customer notifications as read
 */
export async function markAllCustomerNotificationsAsRead(customerId: string) {
  try {
    return await prisma.customer_notification.updateMany({
      where: {
        customerId,
        isRead: false,
      },
      data: { isRead: true },
    });
  } catch (error) {
    console.error("MARK_ALL_CUSTOMER_NOTIFICATIONS_READ_FAILED", error);
    throw error;
  }
}

// ========================================
// Delete Notification Functions
// ========================================

/**
 * Delete a model notification
 */
export async function deleteModelNotification(
  notificationId: string,
  modelId: string
) {
  try {
    return await prisma.model_notification.delete({
      where: {
        id: notificationId,
        modelId,
      },
    });
  } catch (error) {
    console.error("DELETE_MODEL_NOTIFICATION_FAILED", error);
    throw error;
  }
}

/**
 * Delete a customer notification
 */
export async function deleteCustomerNotification(
  notificationId: string,
  customerId: string
) {
  try {
    return await prisma.customer_notification.delete({
      where: {
        id: notificationId,
        customerId,
      },
    });
  } catch (error) {
    console.error("DELETE_CUSTOMER_NOTIFICATION_FAILED", error);
    throw error;
  }
}

// ========================================
// Booking Notification Helpers
// ========================================

/**
 * Send notification when customer creates a new booking
 */
export async function notifyBookingCreated(
  modelId: string,
  customerId: string,
  bookingId: string,
  serviceName: string,
  customerName: string,
  startDate?: Date,
  location?: string,
  price?: number
) {
  await createModelNotification(modelId, {
    type: "booking_created",
    title: "New Booking Request",
    message: `${customerName} has requested to book your "${serviceName}" service.`,
    data: { bookingId, customerId },
  });

  // Send SMS to model
  const dateStr = startDate ? new Date(startDate).toLocaleDateString("lo-LA") : "";
  const priceStr = price ? `${price.toLocaleString()} LAK` : "";
  const smsMessage = `XaoSao: ມີການຈອງໃໝ່! ${customerName} ຈອງບໍລິການ "${serviceName}"${dateStr ? ` ວັນທີ ${dateStr}` : ""}${location ? ` ທີ່ ${location}` : ""}${priceStr ? ` ລາຄາ ${priceStr}` : ""}. ກະລຸນາຕອບຮັບ/ປະຕິເສດໃນແອັບ.`;
  sendSMSToModel(modelId, smsMessage);

  // Send push notification to model
  pushBookingCreated(modelId, customerName, serviceName, bookingId).catch((err) =>
    console.error("[Push] Failed to send booking created push:", err)
  );
}

/**
 * Send notification when model accepts booking
 */
export async function notifyBookingConfirmed(
  customerId: string,
  modelId: string,
  bookingId: string,
  serviceName: string,
  modelName: string,
  startDate?: Date,
  location?: string
) {
  await createCustomerNotification(customerId, {
    type: "booking_confirmed",
    title: "Booking Confirmed",
    message: `${modelName} has accepted your booking for "${serviceName}".`,
    data: { bookingId, modelId },
  });

  // Send SMS to customer
  const dateStr = startDate ? new Date(startDate).toLocaleDateString("lo-LA") : "";
  const smsMessage = `XaoSao: ການຈອງຂອງທ່ານໄດ້ຮັບການຢືນຢັນ! ${modelName} ຕອບຮັບການຈອງ "${serviceName}"${dateStr ? ` ວັນທີ ${dateStr}` : ""}${location ? ` ທີ່ ${location}` : ""}. ກະລຸນາ Check-in ເມື່ອຮອດເວລານັດໝາຍ.`;
  sendSMSToCustomer(customerId, smsMessage);

  // Send push notification to customer
  pushBookingConfirmed(customerId, modelName, serviceName, bookingId).catch((err) =>
    console.error("[Push] Failed to send booking confirmed push:", err)
  );
}

/**
 * Send notification when model rejects booking
 */
export async function notifyBookingRejected(
  customerId: string,
  modelId: string,
  bookingId: string,
  serviceName: string,
  modelName: string,
  reason?: string
) {
  await createCustomerNotification(customerId, {
    type: "booking_rejected",
    title: "Booking Rejected",
    message: `${modelName} has declined your booking for "${serviceName}".${reason ? ` Reason: ${reason}` : ""}`,
    data: { bookingId, modelId, reason },
  });

  // Send SMS to customer
  const smsMessage = `XaoSao: ການຈອງຖືກປະຕິເສດ. ${modelName} ບໍ່ສາມາດຮັບການຈອງ "${serviceName}" ໄດ້${reason ? `. ເຫດຜົນ: ${reason}` : ""}. ເງິນໄດ້ຖືກສົ່ງຄືນໃສ່ Wallet ແລ້ວ.`;
  sendSMSToCustomer(customerId, smsMessage);

  // Send push notification to customer
  pushBookingRejected(customerId, modelName, serviceName, bookingId).catch((err) =>
    console.error("[Push] Failed to send booking rejected push:", err)
  );
}

/**
 * Send notification when customer cancels booking
 */
export async function notifyBookingCancelled(
  modelId: string,
  customerId: string,
  bookingId: string,
  serviceName: string,
  customerName: string,
  startDate?: Date
) {
  await createModelNotification(modelId, {
    type: "booking_cancelled",
    title: "Booking Cancelled",
    message: `${customerName} has cancelled the booking for "${serviceName}".`,
    data: { bookingId, customerId },
  });

  // Send SMS to model
  const dateStr = startDate ? new Date(startDate).toLocaleDateString("lo-LA") : "";
  const smsMessage = `XaoSao: ການຈອງຖືກຍົກເລີກ! ${customerName} ໄດ້ຍົກເລີກການຈອງບໍລິການ "${serviceName}"${dateStr ? ` ວັນທີ ${dateStr}` : ""}.`;
  sendSMSToModel(modelId, smsMessage);

  // Send push notification to model
  pushBookingCancelled(modelId, customerName, serviceName, bookingId).catch((err) =>
    console.error("[Push] Failed to send booking cancelled push:", err)
  );
}

/**
 * Send notification when model marks booking as complete
 */
export async function notifyBookingCompleted(
  customerId: string,
  modelId: string,
  bookingId: string,
  serviceName: string,
  modelName: string,
  price?: number
) {
  await createCustomerNotification(customerId, {
    type: "booking_completed",
    title: "Service Completed",
    message: `${modelName} has marked the "${serviceName}" service as complete. Please confirm within 48 hours.`,
    data: { bookingId, modelId },
  });

  // Send SMS to customer
  const priceStr = price ? `${price.toLocaleString()} LAK` : "";
  const smsMessage = `XaoSao: ${modelName} ແຈ້ງວ່າບໍລິການ "${serviceName}"${priceStr ? ` (${priceStr})` : ""} ສຳເລັດແລ້ວ! ກະລຸນາຢືນຢັນພາຍໃນ 24 ຊົ່ວໂມງ ຫຼື ເງິນຈະຖືກໂອນອັດຕະໂນມັດ.`;
  sendSMSToCustomer(customerId, smsMessage);

  // Send push notification to customer
  pushBookingCompleted(customerId, modelName, serviceName, bookingId).catch((err) =>
    console.error("[Push] Failed to send booking completed push:", err)
  );
}

/**
 * Send notification when customer disputes booking
 */
export async function notifyBookingDisputed(
  modelId: string,
  customerId: string,
  bookingId: string,
  serviceName: string,
  customerName: string,
  reason: string
) {
  await createModelNotification(modelId, {
    type: "booking_disputed",
    title: "Booking Disputed",
    message: `${customerName} has disputed the "${serviceName}" booking. Reason: ${reason}`,
    data: { bookingId, customerId, reason },
  });

  // Send SMS to model
  const smsMessage = `XaoSao: ມີການຮ້ອງຮຽນ! ${customerName} ຮ້ອງຮຽນການຈອງ "${serviceName}". ເຫດຜົນ: ${reason}. ກະລຸນາຕິດຕໍ່ Admin ເພື່ອແກ້ໄຂ.`;
  sendSMSToModel(modelId, smsMessage);
}

/**
 * Send notification when payment is refunded
 */
export async function notifyPaymentRefunded(
  customerId: string,
  bookingId: string,
  amount: number,
  reason: string
) {
  await createCustomerNotification(customerId, {
    type: "payment_refunded",
    title: "Payment Refunded",
    message: `${amount.toLocaleString()} LAK has been refunded to your wallet. Reason: ${reason}`,
    data: { bookingId, amount, reason },
  });
}

/**
 * Send notification for auto-release payment (48h passed)
 */
export async function notifyAutoReleasePayment(
  modelId: string,
  customerId: string,
  bookingId: string,
  amount: number,
  serviceName?: string
) {
  // Notify model
  await createModelNotification(modelId, {
    type: "payment_released",
    title: "Payment Auto-Released",
    message: `${amount.toLocaleString()} LAK has been automatically released to your wallet (48h confirmation window expired).`,
    data: { bookingId, amount },
  });

  // Notify customer
  await createCustomerNotification(customerId, {
    type: "booking_confirmed_completion",
    title: "Booking Auto-Completed",
    message: `Your booking has been automatically completed after the 48-hour confirmation window.`,
    data: { bookingId },
  });

  // Send SMS to model
  const smsMessage = `XaoSao: ເງິນ ${amount.toLocaleString()} LAK${serviceName ? ` ຈາກບໍລິການ "${serviceName}"` : ""} ໄດ້ຖືກໂອນອັດຕະໂນມັດເຂົ້າ Wallet ຂອງທ່ານແລ້ວ (ໝົດເວລາ 24 ຊົ່ວໂມງ).`;
  sendSMSToModel(modelId, smsMessage);

  // Send push notification to model
  pushPaymentReleased(modelId, amount, bookingId).catch((err) =>
    console.error("[Push] Failed to send auto-release payment push:", err)
  );
}

/**
 * Send notification when customer edits booking
 */
export async function notifyBookingEdited(
  modelId: string,
  customerId: string,
  bookingId: string,
  serviceName: string,
  customerName: string,
  startDate?: Date,
  location?: string,
  price?: number
) {
  await createModelNotification(modelId, {
    type: "booking_created", // Reuse type for edit notification
    title: "Booking Updated",
    message: `${customerName} has updated the booking for "${serviceName}".`,
    data: { bookingId, customerId },
  });

  // Send SMS to model
  const dateStr = startDate ? new Date(startDate).toLocaleDateString("lo-LA") : "";
  const priceStr = price ? `${price.toLocaleString()} LAK` : "";
  const smsMessage = `XaoSao: ການຈອງຖືກແກ້ໄຂ! ${customerName} ແກ້ໄຂການຈອງ "${serviceName}"${dateStr ? ` ວັນທີໃໝ່: ${dateStr}` : ""}${location ? ` ສະຖານທີ່: ${location}` : ""}${priceStr ? ` ລາຄາ: ${priceStr}` : ""}. ກະລຸນາກວດສອບໃນແອັບ.`;
  sendSMSToModel(modelId, smsMessage);
}

// ========================================
// Social/Matching Notification Helpers
// ========================================

/**
 * Send notification when someone likes a model's profile
 */
export async function notifyModelLikeReceived(
  modelId: string,
  customerId: string,
  customerName: string
) {
  await createModelNotification(modelId, {
    type: "like_received",
    title: "New Like",
    message: `${customerName} liked your profile.`,
    data: { customerId },
  });
}

/**
 * Send notification when someone likes a customer's profile
 */
export async function notifyCustomerLikeReceived(
  customerId: string,
  modelId: string,
  modelName: string
) {
  await createCustomerNotification(customerId, {
    type: "like_received",
    title: "New Like",
    message: `${modelName} liked your profile.`,
    data: { modelId },
  });
}

/**
 * Send notification when a new match is created (mutual like)
 */
export async function notifyNewMatch(
  modelId: string,
  customerId: string,
  modelName: string,
  customerName: string
) {
  // Notify model
  await createModelNotification(modelId, {
    type: "match_new",
    title: "New Match!",
    message: `You and ${customerName} have matched! Start a conversation now.`,
    data: { customerId },
  });

  // Notify customer
  await createCustomerNotification(customerId, {
    type: "match_new",
    title: "New Match!",
    message: `You and ${modelName} have matched! Start a conversation now.`,
    data: { modelId },
  });

  // Send push notifications to both
  pushNewMatch(modelId, customerId, modelName, customerName).catch((err) =>
    console.error("[Push] Failed to send new match push:", err)
  );
}

/**
 * Send notification when model receives a friend request
 */
export async function notifyModelFriendRequest(
  modelId: string,
  customerId: string,
  customerName: string
) {
  await createModelNotification(modelId, {
    type: "friend_request",
    title: "Friend Request",
    message: `${customerName} sent you a friend request.`,
    data: { customerId },
  });
}

/**
 * Send notification when customer receives a friend request
 */
export async function notifyCustomerFriendRequest(
  customerId: string,
  modelId: string,
  modelName: string
) {
  await createCustomerNotification(customerId, {
    type: "friend_request",
    title: "Friend Request",
    message: `${modelName} sent you a friend request.`,
    data: { modelId },
  });
}

/**
 * Send notification when friend request is accepted - notify model
 */
export async function notifyModelFriendAccepted(
  modelId: string,
  customerId: string,
  customerName: string
) {
  await createModelNotification(modelId, {
    type: "friend_accepted",
    title: "Friend Request Accepted",
    message: `${customerName} accepted your friend request.`,
    data: { customerId },
  });
}

/**
 * Send notification when friend request is accepted - notify customer
 */
export async function notifyCustomerFriendAccepted(
  customerId: string,
  modelId: string,
  modelName: string
) {
  await createCustomerNotification(customerId, {
    type: "friend_accepted",
    title: "Friend Request Accepted",
    message: `${modelName} accepted your friend request.`,
    data: { modelId },
  });
}

// ========================================
// Chat Notification Helpers
// ========================================

/**
 * Send notification for new message to model
 */
export async function notifyModelNewMessage(
  modelId: string,
  customerId: string,
  customerName: string,
  messagePreview: string,
  conversationId?: string
) {
  await createModelNotification(modelId, {
    type: "new_message",
    title: "New Message",
    message: `${customerName}: ${messagePreview.substring(0, 50)}${messagePreview.length > 50 ? "..." : ""}`,
    data: { customerId, conversationId },
  });

  // Send push notification to model
  pushNewMessage("model", modelId, customerName, messagePreview, conversationId).catch((err) =>
    console.error("[Push] Failed to send new message push to model:", err)
  );
}

/**
 * Send notification for new message to customer
 */
export async function notifyCustomerNewMessage(
  customerId: string,
  modelId: string,
  modelName: string,
  messagePreview: string,
  conversationId?: string
) {
  await createCustomerNotification(customerId, {
    type: "new_message",
    title: "New Message",
    message: `${modelName}: ${messagePreview.substring(0, 50)}${messagePreview.length > 50 ? "..." : ""}`,
    data: { modelId, conversationId },
  });

  // Send push notification to customer
  pushNewMessage("customer", customerId, modelName, messagePreview, conversationId).catch((err) =>
    console.error("[Push] Failed to send new message push to customer:", err)
  );
}

// ========================================
// Profile Notification Helpers
// ========================================

/**
 * Send notification when someone views model's profile
 */
export async function notifyModelProfileViewed(
  modelId: string,
  customerId: string,
  customerName: string
) {
  await createModelNotification(modelId, {
    type: "profile_viewed",
    title: "Profile Viewed",
    message: `${customerName} viewed your profile.`,
    data: { customerId },
  });
}

/**
 * Send notification when someone views customer's profile
 */
export async function notifyCustomerProfileViewed(
  customerId: string,
  modelId: string,
  modelName: string
) {
  await createCustomerNotification(customerId, {
    type: "profile_viewed",
    title: "Profile Viewed",
    message: `${modelName} viewed your profile.`,
    data: { modelId },
  });
}

/**
 * Send notification when model profile is approved by admin
 */
export async function notifyModelProfileApproved(modelId: string) {
  await createModelNotification(modelId, {
    type: "profile_approved",
    title: "Profile Approved",
    message: "Your profile has been approved! You can now receive booking requests.",
    data: {},
  });
}

/**
 * Send notification when model identity is verified
 */
export async function notifyModelProfileVerified(modelId: string) {
  await createModelNotification(modelId, {
    type: "profile_verified",
    title: "Profile Verified",
    message: "Your identity has been verified! Your profile now shows a verification badge.",
    data: {},
  });
}

/**
 * Send notification when customer identity is verified
 */
export async function notifyCustomerProfileVerified(customerId: string) {
  await createCustomerNotification(customerId, {
    type: "profile_verified",
    title: "Profile Verified",
    message: "Your identity has been verified! Your profile now shows a verification badge.",
    data: {},
  });
}

// ========================================
// Transaction Notification Helpers
// ========================================

/**
 * Send notification when customer deposit is approved
 */
export async function notifyCustomerDepositApproved(
  customerId: string,
  amount: number,
  transactionId?: string
) {
  await createCustomerNotification(customerId, {
    type: "deposit_approved",
    title: "Deposit Approved",
    message: `Your deposit of ${amount.toLocaleString()} LAK has been approved and added to your wallet.`,
    data: { amount, transactionId },
  });

  // Send push notification to customer
  pushDepositApproved(customerId, amount).catch((err) =>
    console.error("[Push] Failed to send deposit approved push:", err)
  );
}

/**
 * Send notification when customer deposit is rejected
 */
export async function notifyCustomerDepositRejected(
  customerId: string,
  amount: number,
  reason?: string,
  transactionId?: string
) {
  await createCustomerNotification(customerId, {
    type: "deposit_rejected",
    title: "Deposit Rejected",
    message: `Your deposit of ${amount.toLocaleString()} LAK has been rejected.${reason ? ` Reason: ${reason}` : ""}`,
    data: { amount, reason, transactionId },
  });
}

/**
 * Send notification when model withdrawal is approved
 */
export async function notifyModelWithdrawApproved(
  modelId: string,
  amount: number,
  transactionId?: string
) {
  await createModelNotification(modelId, {
    type: "withdraw_approved",
    title: "Withdrawal Approved",
    message: `Your withdrawal of ${amount.toLocaleString()} LAK has been approved and processed.`,
    data: { amount, transactionId },
  });

  // Send push notification to model
  pushWithdrawApproved(modelId, amount).catch((err) =>
    console.error("[Push] Failed to send withdraw approved push:", err)
  );
}

/**
 * Send notification when model withdrawal is rejected
 */
export async function notifyModelWithdrawRejected(
  modelId: string,
  amount: number,
  reason?: string,
  transactionId?: string
) {
  await createModelNotification(modelId, {
    type: "withdraw_rejected",
    title: "Withdrawal Rejected",
    message: `Your withdrawal request of ${amount.toLocaleString()} LAK has been rejected.${reason ? ` Reason: ${reason}` : ""} The amount has been returned to your wallet.`,
    data: { amount, reason, transactionId },
  });
}

// ========================================
// System Notification Helpers
// ========================================

/**
 * Send welcome notification to new model
 */
export async function notifyModelWelcome(modelId: string, modelName: string) {
  await createModelNotification(modelId, {
    type: "welcome",
    title: "Welcome to XaoSao!",
    message: `Hi ${modelName}! Welcome to XaoSao. Complete your profile to start receiving booking requests.`,
    data: {},
  });
}

/**
 * Send welcome notification to new customer
 */
export async function notifyCustomerWelcome(customerId: string, customerName: string) {
  await createCustomerNotification(customerId, {
    type: "welcome",
    title: "Welcome to XaoSao!",
    message: `Hi ${customerName}! Welcome to XaoSao. Explore and discover amazing models near you.`,
    data: {},
  });
}
