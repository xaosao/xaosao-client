import type { ActionFunction } from "react-router";
import { getUserFromSession } from "~/services/auths.server";
import { getModelFromSession } from "~/services/model-auth.server";
import { endCall } from "~/services/call-booking.server";

/**
 * POST /api/call/end
 * End the call and process payment
 */
export const action: ActionFunction = async ({ request }) => {
  if (request.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }

  try {
    const customerId = await getUserFromSession(request);
    const modelId = await getModelFromSession(request);

    if (!customerId && !modelId) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { bookingId, endedBy } = body;

    if (!bookingId) {
      return Response.json(
        { error: "Booking ID is required" },
        { status: 400 }
      );
    }

    // Determine who ended the call
    const whoEnded = endedBy || (customerId ? "customer" : "model");

    const result = await endCall(bookingId, whoEnded);

    return Response.json(result);
  } catch (error: any) {
    console.error("[API] Call end error:", error);
    return Response.json(
      { success: false, error: error.message || "Failed to end call" },
      { status: 500 }
    );
  }
};
