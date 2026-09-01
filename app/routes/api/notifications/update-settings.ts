import type { ActionFunction } from "react-router";
import { prisma } from "~/services/database.server";
import { getModelFromSession } from "~/services/model-auth.server";
import { getUserFromSession } from "~/services/auths.server";
import { updateNotificationSettings } from "~/services/xs-notification.server";

export const action: ActionFunction = async ({ request }) => {
  if (request.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }

  try {
    const body = await request.json();
    const { userType, sendPushNoti, sendSMSNoti } = body;

    if (!userType || typeof sendPushNoti !== "boolean" || typeof sendSMSNoti !== "boolean") {
      return Response.json({ error: "Invalid request body" }, { status: 400 });
    }

    if (userType === "model") {
      const modelId = await getModelFromSession(request);
      if (!modelId) {
        return Response.json({ error: "Unauthorized" }, { status: 401 });
      }

      // Write through xs_backend so the app and the web agree, falling back
      // to a direct write if the backend is unreachable. Both paths land on
      // the same `sendPushNoti` / `sendSMSNoti` columns.
      const viaApi = await updateNotificationSettings(
        { userId: modelId, userType: "model" },
        { push_enabled: sendPushNoti, sms_enabled: sendSMSNoti }
      );

      if (!viaApi) {
        await prisma.model.update({
          where: { id: modelId },
          data: { sendPushNoti, sendSMSNoti },
        });
      }

      return Response.json({ success: true });
    } else if (userType === "customer") {
      const customerId = await getUserFromSession(request);
      if (!customerId) {
        return Response.json({ error: "Unauthorized" }, { status: 401 });
      }

      const viaApi = await updateNotificationSettings(
        { userId: customerId, userType: "customer" },
        { push_enabled: sendPushNoti, sms_enabled: sendSMSNoti }
      );

      if (!viaApi) {
        await prisma.customer.update({
          where: { id: customerId },
          data: { sendPushNoti, sendSMSNoti },
        });
      }

      return Response.json({ success: true });
    } else {
      return Response.json({ error: "Invalid user type" }, { status: 400 });
    }
  } catch (error) {
    console.error("[UpdateNotificationSettings] Error:", error);
    return Response.json({ error: "Failed to update notification settings" }, { status: 500 });
  }
};
