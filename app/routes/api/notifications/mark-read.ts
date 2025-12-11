import type { ActionFunction } from "react-router";
import { getUserFromSession } from "~/services/auths.server";
import { getModelFromSession } from "~/services/model-auth.server";
import {
  markCustomerNotificationAsRead,
  markModelNotificationAsRead,
} from "~/services/notification.server";

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
    if (userType === "model") {
      const modelId = await getModelFromSession(request);
      if (!modelId) {
        return Response.json({ error: "Unauthorized" }, { status: 401 });
      }
      await markModelNotificationAsRead(notificationId, modelId);
    } else {
      const customerId = await getUserFromSession(request);
      if (!customerId) {
        return Response.json({ error: "Unauthorized" }, { status: 401 });
      }
      await markCustomerNotificationAsRead(notificationId, customerId);
    }

    return Response.json({ success: true });
  } catch (error) {
    console.error("MARK_NOTIFICATION_READ_FAILED", error);
    return Response.json({ error: "Failed to mark as read" }, { status: 500 });
  }
};