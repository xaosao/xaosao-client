import type { ActionFunction } from "react-router";
import { getModelFromSession } from "~/services/model-auth.server";
import { acceptCall } from "~/services/call-booking.server";

/**
 * POST /api/call/accept
 * Model accepts an incoming call
 */
export const action: ActionFunction = async ({ request }) => {
  if (request.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }

  try {
    const modelId = await getModelFromSession(request);

    if (!modelId) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { bookingId } = body;

    if (!bookingId) {
      return Response.json(
        { error: "Booking ID is required" },
        { status: 400 }
      );
    }

    const result = await acceptCall(bookingId, modelId);

    return Response.json(result);
  } catch (error: any) {
    console.error("[API] Call accept error:", error);
    return Response.json(
      { success: false, error: error.message || "Failed to accept call" },
      { status: 500 }
    );
  }
};
