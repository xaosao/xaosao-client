import type { ActionFunction } from "react-router";
import { getUserFromSession } from "~/services/auths.server";
import { getModelFromSession } from "~/services/model-auth.server";
import { removePushSubscription, removeAllUserSubscriptions } from "~/services/push.server";

/**
 * POST /api/push/unsubscribe
 * Removes a push subscription for the authenticated user
 */
export const action: ActionFunction = async ({ request }) => {
  if (request.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }

  try {
    // Try to get user from either customer or model session
    const customerId = await getUserFromSession(request);
    const modelId = await getModelFromSession(request);

    if (!customerId && !modelId) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { endpoint, removeAll } = body;

    // Determine user type
    const userType = customerId ? "customer" : "model";
    const userId = customerId || modelId;

    if (removeAll) {
      // Remove all subscriptions for this user
      await removeAllUserSubscriptions(
        userType as "customer" | "model",
        userId!
      );
    } else if (endpoint) {
      // Remove specific subscription
      const result = await removePushSubscription(
        endpoint,
        userType as "customer" | "model",
        userId!
      );

      if (!result.success) {
        return Response.json({ error: result.error }, { status: 500 });
      }
    } else {
      return Response.json(
        { error: "Missing endpoint or removeAll flag" },
        { status: 400 }
      );
    }

    return Response.json({ success: true });
  } catch (error) {
    console.error("[API] Push unsubscribe error:", error);
    return Response.json(
      { error: "Failed to remove subscription" },
      { status: 500 }
    );
  }
};
