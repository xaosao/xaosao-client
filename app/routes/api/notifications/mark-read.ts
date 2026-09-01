/**
 * Mark one notification as read.
 *
 * Goes through the xs_backend notification API so web and app share one
 * source of truth for read state, with the website's own Prisma write as a
 * fallback if the backend is unreachable (both touch the same collection).
 */

import type { ActionFunction } from "react-router";
import { getUserFromSession } from "~/services/auths.server";
import { getModelFromSession } from "~/services/model-auth.server";
import { markNotificationsRead } from "~/services/xs-notification.server";

export const action: ActionFunction = async ({ request }) => {
  if (request.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const formData = await request.formData();
  const notificationId = formData.get("notificationId") as string;
  const userType = formData.get("userType") as "model" | "customer";

  if (!notificationId || !userType) {
    return Response.json({ error: "Missing required fields" }, { status: 400 });
  }

  try {
    const userId =
      userType === "model"
        ? await getModelFromSession(request)
        : await getUserFromSession(request);

    if (!userId) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const done = await markNotificationsRead({ userId, userType }, [
      notificationId,
    ]);

    if (!done) {
      const {
        markCustomerNotificationAsRead,
        markModelNotificationAsRead,
      } = await import("~/services/notification.server");

      if (userType === "model") {
        await markModelNotificationAsRead(notificationId, userId);
      } else {
        await markCustomerNotificationAsRead(notificationId, userId);
      }
    }

    return Response.json({ success: true });
  } catch (error) {
    console.error("MARK_NOTIFICATION_READ_FAILED", error);
    return Response.json({ error: "Failed to mark as read" }, { status: 500 });
  }
};
