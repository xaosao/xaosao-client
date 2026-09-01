/**
 * Notifications, read through the xs_backend API (`/api/v1/notifications/*`).
 *
 * Reads move here so the web bell shows exactly what the app shows — same
 * ordering, same unread count, same `type`/`data` deep-link contract, plus the
 * Lao copy (`la_title` / `la_message`) the backend resolves from
 * notification-text.ts.
 *
 * Delivery is deliberately unchanged: the website keeps writing rows through
 * `notification.server.ts` (Prisma) and keeps its SSE stream + VAPID web push.
 * Both sides write the same `customer_notification` / `model_notification`
 * collections, so a row created by either service shows up here.
 */

import { unwrapEnvelope, xsRequest } from "./xs-api.server";
import type { XsUserType } from "./xs-jwt.server";
import { xsDateToIso } from "~/utils/xs-date";
import type { Notification } from "~/stores/notification.store";

interface Viewer {
  userId: string;
  userType: XsUserType;
}

/** Raw item shape from `NotificationService.formatNotification`. */
interface XsNotificationItem {
  id: string;
  type: string;
  title: string;
  message: string;
  la_title?: string;
  la_message?: string;
  data?: Record<string, any> | null;
  is_read: boolean;
  created_at: string;
}

/**
 * The store's `Notification` plus the Lao strings, so components can pick the
 * right language at render time without a second round trip.
 */
export interface XsNotification extends Notification {
  laTitle?: string;
  laMessage?: string;
}

function toStoreShape(item: XsNotificationItem): XsNotification {
  return {
    id: item.id,
    type: item.type,
    title: item.title,
    message: item.message,
    laTitle: item.la_title || undefined,
    laMessage: item.la_message || undefined,
    data: (item.data ?? {}) as Record<string, any>,
    isRead: !!item.is_read,
    createdAt: xsDateToIso(item.created_at),
  };
}

/**
 * GET /notifications
 *
 * Returns `null` on failure rather than throwing — the layout loader calls
 * this on every navigation and a backend hiccup must not blank the page. The
 * caller falls back to its existing Prisma read.
 */
export async function fetchNotifications(
  viewer: Viewer,
  options: { page?: number; limit?: number; unreadOnly?: boolean } = {}
): Promise<{
  notifications: XsNotification[];
  unreadCount: number;
  total: number;
  totalPages: number;
} | null> {
  try {
    const response = await xsRequest<any>("notifications", {
      ...viewer,
      timeoutMs: 8_000,
      query: {
        page: options.page ?? 1,
        limit: options.limit ?? 20,
        unread_only: options.unreadOnly ? "true" : undefined,
      },
    });

    const payload = unwrapEnvelope<{
      items: XsNotificationItem[];
      pagination: { total: number; total_pages: number };
      unread_count: number;
    }>(response);

    return {
      notifications: (payload?.items ?? []).map(toStoreShape),
      unreadCount: payload?.unread_count ?? 0,
      total: payload?.pagination?.total ?? 0,
      totalPages: payload?.pagination?.total_pages ?? 1,
    };
  } catch (error) {
    console.error(
      "[xs-notification] list failed:",
      (error as Error)?.message
    );
    return null;
  }
}

/** GET /notifications/unread-count — degrades to `null` so callers can fall back. */
export async function fetchUnreadCount(viewer: Viewer): Promise<number | null> {
  try {
    const response = await xsRequest<any>("notifications/unread-count", {
      ...viewer,
      timeoutMs: 5_000,
    });
    const payload = unwrapEnvelope<{ unread_count: number }>(response);
    return payload?.unread_count ?? 0;
  } catch (error) {
    console.error(
      "[xs-notification] unread-count failed:",
      (error as Error)?.message
    );
    return null;
  }
}

/**
 * POST /notifications/read
 *
 * The backend rejects anything that isn't a 24-char hex ObjectId, so ids are
 * filtered here — an invalid id would otherwise 400 the whole batch.
 */
export async function markNotificationsRead(
  viewer: Viewer,
  notificationIds: string[]
): Promise<boolean> {
  const ids = notificationIds.filter((id) => /^[a-fA-F0-9]{24}$/.test(id));
  if (ids.length === 0) return false;

  try {
    await xsRequest("notifications/read", {
      ...viewer,
      method: "POST",
      body: { notification_ids: ids },
    });
    return true;
  } catch (error) {
    console.error(
      "[xs-notification] mark read failed:",
      (error as Error)?.message
    );
    return false;
  }
}

/** POST /notifications/read-all */
export async function markAllNotificationsRead(
  viewer: Viewer
): Promise<boolean> {
  try {
    await xsRequest("notifications/read-all", { ...viewer, method: "POST" });
    return true;
  } catch (error) {
    console.error(
      "[xs-notification] mark all read failed:",
      (error as Error)?.message
    );
    return false;
  }
}

/**
 * What the customer / model layouts need for the notification bell: the
 * unread badge count plus the most recent rows for the popover preview.
 *
 * Reads from xs_backend, and falls back to the website's own Prisma queries if
 * the backend is unreachable — the bell is on every authenticated page, so a
 * chat/notification outage must not degrade the rest of the site.
 */
export async function loadNotificationFeed(
  userId: string,
  userType: XsUserType,
  limit = 10
): Promise<{
  unreadNotifications: number;
  initialNotifications: XsNotification[];
}> {
  const feed = await fetchNotifications({ userId, userType }, { limit });

  if (feed) {
    return {
      unreadNotifications: feed.unreadCount,
      initialNotifications: feed.notifications,
    };
  }

  console.warn(
    `[xs-notification] falling back to Prisma for ${userType} ${userId}`
  );

  const {
    getCustomerNotifications,
    getCustomerUnreadCount,
    getModelNotifications,
    getModelUnreadCount,
  } = await import("./notification.server");

  const isModel = userType === "model";
  const [count, rows] = await Promise.all([
    (isModel ? getModelUnreadCount(userId) : getCustomerUnreadCount(userId)).catch(
      () => 0
    ),
    (isModel
      ? getModelNotifications(userId, { limit })
      : getCustomerNotifications(userId, { limit })
    ).catch(() => [] as any[]),
  ]);

  return {
    unreadNotifications: count,
    initialNotifications: (rows || []).map((n: any) => ({
      id: n.id,
      type: n.type,
      title: n.title,
      message: n.message,
      data: (n.data ?? {}) as Record<string, any>,
      isRead: n.isRead,
      createdAt:
        n.createdAt instanceof Date
          ? n.createdAt.toISOString()
          : xsDateToIso(n.createdAt),
    })),
  };
}

/**
 * Notification preferences, via xs_backend — the same endpoints the mobile app
 * uses (`GET`/`PUT /notifications/settings`), so a change made on the web is
 * reflected in the app and vice versa.
 *
 * Both sides write the same `sendPushNoti` / `sendMailNoti` / `sendSMSNoti` /
 * `sendWhatsappNoti` columns on the customer or model row, so this stays
 * consistent with the website's own settings screens.
 */
export interface XsNotificationSettings {
  push_enabled: boolean;
  email_enabled: boolean;
  sms_enabled: boolean;
  whatsapp_enabled: boolean;
}

/** GET /notifications/settings — `null` when the backend is unreachable. */
export async function fetchNotificationSettings(
  viewer: Viewer
): Promise<XsNotificationSettings | null> {
  try {
    const response = await xsRequest<any>("notifications/settings", {
      ...viewer,
      timeoutMs: 8_000,
    });
    const data = unwrapEnvelope<any>(response);
    return {
      push_enabled: !!data?.push_enabled,
      email_enabled: !!data?.email_enabled,
      sms_enabled: !!data?.sms_enabled,
      whatsapp_enabled: !!data?.whatsapp_enabled,
    };
  } catch (error) {
    console.error(
      "[xs-notification] settings read failed:",
      (error as Error)?.message
    );
    return null;
  }
}

/**
 * PUT /notifications/settings — only the keys provided are changed.
 * Returns false on failure so callers can fall back to a local write.
 */
export async function updateNotificationSettings(
  viewer: Viewer,
  settings: Partial<XsNotificationSettings>
): Promise<boolean> {
  const body: Record<string, boolean> = {};
  for (const key of [
    "push_enabled",
    "email_enabled",
    "sms_enabled",
    "whatsapp_enabled",
  ] as const) {
    if (typeof settings[key] === "boolean") body[key] = settings[key]!;
  }
  // The backend rejects an empty body with 400 rather than treating it as a
  // no-op, so don't send one.
  if (Object.keys(body).length === 0) return true;

  try {
    await xsRequest("notifications/settings", {
      ...viewer,
      method: "PUT",
      body,
    });
    return true;
  } catch (error) {
    console.error(
      "[xs-notification] settings update failed:",
      (error as Error)?.message
    );
    return false;
  }
}
