/**
 * Unified Notification Service
 *
 * Sends notifications to all 3 channels (SMS, Push, In-App) with a single function call.
 * Respects user preferences (sendSMSNoti, sendPushNoti).
 *
 * Usage:
 * ```typescript
 * await notifyUser({
 *   userType: "customer",
 *   userId: "xxx",
 *   notificationType: "welcome",
 *   title: "Welcome to XaoSao!",
 *   message: "Hi John! Welcome to XaoSao.",
 *   smsMessage: "XaoSao: ຍິນດີຕ້ອນຮັບ John!", // Optional shorter SMS
 *   url: "/customer", // Optional deep link
 * });
 * ```
 */

import {
  createModelNotification,
  createCustomerNotification,
  sendSMSToModel,
  sendSMSToCustomer,
  type NotificationType,
} from "./notification.server";
import { sendPushToUser } from "./push.server";

// ========================================
// Types
// ========================================

export type UserType = "customer" | "model";

export interface NotifyUserParams {
  /** User type: "customer" or "model" */
  userType: UserType;
  /** User ID (MongoDB ObjectId) */
  userId: string;
  /** Notification type (e.g., "welcome", "booking_created", "commission_earned") */
  notificationType: NotificationType | string;
  /** Notification title */
  title: string;
  /** Notification message/body */
  message: string;
  /** Optional shorter SMS message (if not provided, uses title + message) */
  smsMessage?: string;
  /** Additional data for in-app notification (e.g., bookingId, modelId) */
  data?: Record<string, any>;
  /** Deep link URL for push notification click action */
  url?: string;
  /** Optional push notification action buttons */
  actions?: Array<{
    action: string;
    title: string;
    icon?: string;
  }>;
  /** Skip SMS for this notification (useful for broadcast/bulk notifications) */
  skipSMS?: boolean;
}

export interface NotifyUserResult {
  /** Whether in-app notification was created successfully */
  inApp: boolean;
  /** Whether SMS was sent (may be false if user disabled or no phone) */
  sms: boolean;
  /** Push notification result: number sent and failed */
  push: { sent: number; failed: number };
}

// ========================================
// Unified Notification Function
// ========================================

/**
 * Send notification to user via all 3 channels:
 * 1. In-App notification (always - stored in database, shown via SSE)
 * 2. SMS (if user has sendSMSNoti enabled and has phone number)
 * 3. Push notification (if user has sendPushNoti enabled and has subscriptions)
 *
 * All channels are executed in parallel for performance.
 * Errors in one channel don't affect others.
 */
export async function notifyUser(
  params: NotifyUserParams
): Promise<NotifyUserResult> {
  const {
    userType,
    userId,
    notificationType,
    title,
    message,
    smsMessage,
    data,
    url,
    actions,
    skipSMS = false,
  } = params;

  const result: NotifyUserResult = {
    inApp: false,
    sms: false,
    push: { sent: 0, failed: 0 },
  };

  // Prepare SMS text
  const smsText = smsMessage || `XaoSao: ${title}. ${message}`;

  // Prepare notification payload
  const notificationPayload = {
    type: notificationType as NotificationType,
    title,
    message,
    data: data || {},
  };

  // Prepare push payload
  const pushPayload = {
    title,
    body: message,
    tag: `${notificationType}-${userId}-${Date.now()}`,
    data: {
      type: notificationType,
      ...data,
      url:
        url ||
        (userType === "customer"
          ? "/customer/notifications"
          : "/model/notifications"),
    },
    actions,
  };

  // Execute all channels in parallel
  const [inAppResult, smsResult, pushResult] = await Promise.allSettled([
    // 1. In-App Notification (always)
    userType === "model"
      ? createModelNotification(userId, notificationPayload)
      : createCustomerNotification(userId, notificationPayload),

    // 2. SMS (respects user preference, skipped for broadcast notifications)
    skipSMS
      ? Promise.resolve()
      : userType === "model"
        ? sendSMSToModel(userId, smsText)
        : sendSMSToCustomer(userId, smsText),

    // 3. Push Notification (respects user preference)
    sendPushToUser(userType, userId, pushPayload),
  ]);

  // Process results
  if (inAppResult.status === "fulfilled") {
    result.inApp = true;
  } else {
    console.error(
      `[UnifiedNotification] In-app notification failed for ${userType}:${userId}:`,
      inAppResult.reason
    );
  }

  if (smsResult.status === "fulfilled") {
    result.sms = true;
  } else {
    console.error(
      `[UnifiedNotification] SMS failed for ${userType}:${userId}:`,
      smsResult.reason
    );
  }

  if (pushResult.status === "fulfilled") {
    result.push = pushResult.value;
  } else {
    console.error(
      `[UnifiedNotification] Push notification failed for ${userType}:${userId}:`,
      pushResult.reason
    );
  }

  console.log(
    `[UnifiedNotification] ${notificationType} to ${userType}:${userId} - InApp:${result.inApp}, SMS:${result.sms}, Push:${result.push.sent}/${result.push.sent + result.push.failed}`
  );

  return result;
}

// ========================================
// Helper Functions for Common Notifications
// ========================================

/**
 * Send welcome notification to new customer
 */
export async function notifyCustomerWelcome(
  customerId: string,
  customerName: string
): Promise<NotifyUserResult> {
  return notifyUser({
    userType: "customer",
    userId: customerId,
    notificationType: "welcome",
    title: "ຍິນດີຕ້ອນຮັບສູ່ XaoSao!",
    message: `ສະບາຍດີ ${customerName}! ຍິນດີຕ້ອນຮັບສູ່ XaoSao. ທ່ານສະມາດເລີ່ມຕົ້ນສົນທະນາ ແລະ ຈອງຄູ່ທີ່ທ່ານມັກໄດ້ເລີຍ.`,
    url: "/customer",
    skipSMS: true,
  });
}

/**
 * Send welcome notification to new model (after admin approval)
 */
export async function notifyModelWelcome(
  modelId: string,
  modelName: string
): Promise<NotifyUserResult> {
  return notifyUser({
    userType: "model",
    userId: modelId,
    notificationType: "welcome",
    title: "ຍິນດີຕ້ອນຮັບສູ່ XaoSao!",
    message: `ຂໍສະແດງຄວາມຍິນດີ ${modelName}! ບັນຊີຂອງທ່ານໄດ້ຮັບການອະນຸມັດແລ້ວ. ເລີ່ມຮັບການຈອງໄດ້ເລີຍ.`,
    smsMessage: `XaoSao: ຍິນດີດ້ວຍ ${modelName}! ບັນຊີຂອງທ່ານໄດ້ຮັບການອະນຸມັດແລ້ວ. ເລີ່ມຮັບການຈອງໄດ້ເລີຍ.`,
    url: "/model",
  });
}

/**
 * Notify referrer model when someone registers via their link
 */
export async function notifyReferralRegistered(
  referrerId: string,
  referredName: string,
  referredType: "customer" | "model"
): Promise<NotifyUserResult> {
  const isModel = referredType === "model";
  return notifyUser({
    userType: "model",
    userId: referrerId,
    notificationType: "referral_registered",
    title: isModel ? "ການແນະນຳໂມເດວໃໝ່!" : "ການແນະນຳລູກຄ້າໃໝ່!",
    message: isModel
      ? `${referredName} ລົງທະບຽນຜ່ານລິ້ງແນະນຳຂອງທ່ານ. ລໍຖ້າ admin ອະນຸມັດ.`
      : `${referredName} ລົງທະບຽນຜ່ານລິ້ງແນະນຳຂອງທ່ານ.`,
    smsMessage: isModel
      ? `XaoSao: ${referredName} ລົງທະບຽນຜ່ານລິ້ງແນະນຳຂອງທ່ານ! ລໍຖ້າ admin ອະນຸມັດ.`
      : `XaoSao: ${referredName} ລົງທະບຽນຜ່ານລິ້ງແນະນຳຂອງທ່ານ!`,
    data: { referredType },
    url: "/model/referral",
  });
}

/**
 * Notify referrer model when they earn commission
 */
export async function notifyCommissionEarned(
  referrerId: string,
  amount: number,
  source: "booking" | "subscription",
  customerName: string,
  additionalData?: Record<string, any>
): Promise<NotifyUserResult> {
  const sourceTitleLao = source === "booking" ? "ການຈອງ" : "ການສະໝັກສະມາຊິກ";
  const sourceNameLao = source === "booking" ? "ການຈອງ" : "ການສະໝັກສະມາຊິກ";

  return notifyUser({
    userType: "model",
    userId: referrerId,
    notificationType: "commission_earned",
    title: `ໄດ້ຮັບຄ່ານາຍໜ້າຈາກ${sourceTitleLao}!`,
    message: `ທ່ານໄດ້ຮັບ ${amount.toLocaleString()} LAK ຈາກ${sourceNameLao}ຂອງ ${customerName}.`,
    smsMessage: `XaoSao: ທ່ານໄດ້ຮັບ ${amount.toLocaleString()} LAK ຈາກ${sourceNameLao}ຂອງ ${customerName}!`,
    data: { commissionAmount: amount, source, customerName, ...additionalData },
    url: "/model/settings/wallet",
  });
}

/**
 * Notify model when they are auto-upgraded to a new type
 */
export async function notifyModelTypeUpgrade(
  modelId: string,
  newType: "special" | "partner",
  modelName: string
): Promise<NotifyUserResult> {
  const isPartner = newType === "partner";

  const titleLao = isPartner
    ? "ຍິນດີດ້ວຍ! ທ່ານໄດ້ຮັບການອັບເກຣດເປັນ Partner!"
    : "ຍິນດີດ້ວຍ! ທ່ານໄດ້ຮັບການອັບເກຣດເປັນ Special!";

  const messageLao = isPartner
    ? `${modelName}, ທ່ານໄດ້ບັນລຸເປົ້າໝາຍແລ້ວ! ຕອນນີ້ທ່ານຈະໄດ້ຮັບ 40% ຈາກການສະໝັກສະມາຊິກ ແລະ 4% ຈາກການຈອງຂອງໂມເດວທີ່ທ່ານແນະນຳ.`
    : `${modelName}, ທ່ານໄດ້ແນະນຳໂມເດວຄົບຕາມເປົ້າໝາຍແລ້ວ! ຕອນນີ້ທ່ານຈະໄດ້ຮັບ 20% ຈາກການສະໝັກສະມາຊິກ ແລະ 2% ຈາກການຈອງຂອງໂມເດວທີ່ທ່ານແນະນຳ.`;

  const smsMessageLao = isPartner
    ? `XaoSao: ຍິນດີດ້ວຍ ${modelName}! ທ່ານໄດ້ອັບເກຣດເປັນ Partner ແລ້ວ! ໄດ້ຮັບ 40% subscription + 4% booking.`
    : `XaoSao: ຍິນດີດ້ວຍ ${modelName}! ທ່ານໄດ້ອັບເກຣດເປັນ Special ແລ້ວ! ໄດ້ຮັບ 20% subscription + 2% booking.`;

  return notifyUser({
    userType: "model",
    userId: modelId,
    notificationType: "model_type_upgrade",
    title: titleLao,
    message: messageLao,
    smsMessage: smsMessageLao,
    data: { newType, previousType: isPartner ? "special" : "normal" },
    url: "/model/referral",
  });
}
