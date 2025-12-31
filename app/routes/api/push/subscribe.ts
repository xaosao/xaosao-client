import type { ActionFunction, LoaderFunction } from "react-router";
import { getUserFromSession } from "~/services/auths.server";
import { getModelFromSession } from "~/services/model-auth.server";
import { savePushSubscription, getVapidPublicKey } from "~/services/push.server";

/**
 * GET /api/push/subscribe
 * Returns the VAPID public key for client-side subscription
 */
export const loader: LoaderFunction = async () => {
  const vapidPublicKey = getVapidPublicKey();

  if (!vapidPublicKey) {
    return Response.json(
      { error: "Push notifications not configured" },
      { status: 503 }
    );
  }

  return Response.json({ vapidPublicKey });
};

/**
 * POST /api/push/subscribe
 * Saves a push subscription for the authenticated user
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
    const { subscription, userAgent } = body;

    if (!subscription || !subscription.endpoint || !subscription.keys) {
      return Response.json(
        { error: "Invalid subscription data" },
        { status: 400 }
      );
    }

    // Determine user type
    const userType = customerId ? "customer" : "model";
    const userId = customerId || modelId;

    // Save subscription
    const result = await savePushSubscription(
      subscription,
      userType as "customer" | "model",
      userId!,
      userAgent
    );

    if (!result.success) {
      return Response.json({ error: result.error }, { status: 500 });
    }

    return Response.json({ success: true });
  } catch (error) {
    console.error("[API] Push subscribe error:", error);
    return Response.json(
      { error: "Failed to save subscription" },
      { status: 500 }
    );
  }
};
