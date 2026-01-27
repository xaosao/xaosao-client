import type { ActionFunction } from "react-router";
import { requireUserSession } from "~/services/auths.server";
import { createSubscriptionWithWallet } from "~/services/package.server";

export const action: ActionFunction = async ({ request }) => {
  if (request.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }

  try {
    const customerId = await requireUserSession(request);
    const body = await request.json();
    const { planId } = body;

    if (!planId) {
      return Response.json(
        { success: false, error: true, message: "Plan ID is required" },
        { status: 400 }
      );
    }

    // Use the existing subscription service to create subscription with wallet
    const subscription = await createSubscriptionWithWallet(customerId, planId);

    return Response.json({
      success: true,
      message: "Subscription activated successfully!",
      subscription,
    });
  } catch (error: any) {
    console.error("[SubscribeTrial] Error:", error);

    return Response.json(
      {
        success: false,
        error: true,
        message: error.message || "Failed to activate subscription",
      },
      { status: 500 }
    );
  }
};
