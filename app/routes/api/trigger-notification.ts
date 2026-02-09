import type { ActionFunction } from "react-router";
import {
  notificationEmitter,
  getCustomerChannel,
  getModelChannel,
} from "~/services/notification.server";

/**
 * API endpoint for the admin to trigger real-time SSE notifications
 * on the client. The admin creates the DB record, then calls this
 * endpoint to push the event through the client's in-memory emitter.
 *
 * POST /api/trigger-notification
 */
export const action: ActionFunction = async ({ request }) => {
  if (request.method !== "POST") {
    return Response.json({ success: false, error: "Method not allowed" }, { status: 405 });
  }

  try {
    // Validate API secret
    const apiSecret = request.headers.get("X-API-Secret");
    const expectedSecret = process.env.SSE_API_SECRET;

    if (!apiSecret || !expectedSecret || apiSecret !== expectedSecret) {
      return Response.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { userType, userId, notification } = body;

    if (!userType || !userId || !notification) {
      return Response.json(
        { success: false, error: "Missing required fields: userType, userId, notification" },
        { status: 400 }
      );
    }

    // Emit to the correct SSE channel
    const channel = userType === "model"
      ? getModelChannel(userId)
      : getCustomerChannel(userId);

    notificationEmitter.emit(channel, {
      id: notification.id || `admin-${Date.now()}`,
      type: notification.type,
      title: notification.title,
      message: notification.message,
      data: notification.data || {},
      createdAt: notification.createdAt || new Date().toISOString(),
    });

    console.log(`[SSE Trigger] Notification sent to ${userType} ${userId}: ${notification.type}`);

    return Response.json({ success: true });
  } catch (error: any) {
    console.error("[SSE Trigger] Error:", error);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
};
