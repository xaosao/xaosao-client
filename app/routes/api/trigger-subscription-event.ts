import type { ActionFunction } from "react-router";
import { sendSubscriptionEvent } from "./subscription-events";

export const action: ActionFunction = async ({ request }) => {
  if (request.method !== "POST") {
    return Response.json({ success: false, error: "Method not allowed" }, { status: 405 });
  }

  try {
    // Validate API secret
    const apiSecret = request.headers.get("X-API-Secret");
    const expectedSecret = process.env.SSE_API_SECRET;

    if (!apiSecret || !expectedSecret || apiSecret !== expectedSecret) {
      console.error("[SSE Trigger] Invalid API secret");
      return Response.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Parse request body
    const body = await request.json();
    const { customerId, subscriptionId, status } = body;

    // Validate required fields
    if (!customerId || !subscriptionId || !status) {
      return Response.json(
        {
          success: false,
          error: "Missing required fields: customerId, subscriptionId, status",
        },
        { status: 400 }
      );
    }

    // Send SSE event to customer
    const sent = sendSubscriptionEvent(customerId, {
      subscriptionId,
      status,
    });

    if (sent) {
      console.log(
        `[SSE Trigger] Successfully sent event to customer ${customerId}`
      );
      return Response.json({
        success: true,
        message: "Event sent successfully",
        customerId,
      });
    } else {
      console.log(
        `[SSE Trigger] Customer ${customerId} not connected, event not sent`
      );
      return Response.json(
        {
          success: false,
          error: "Customer not connected",
          customerId,
        },
        { status: 404 }
      );
    }
  } catch (error: any) {
    console.error("[SSE Trigger] Error processing request:", error);
    return Response.json(
      {
        success: false,
        error: error.message || "Internal server error",
      },
      { status: 500 }
    );
  }
};
