import type { ActionFunction } from "react-router";
import { getUserFromSession } from "~/services/auths.server";
import { getModelFromSession } from "~/services/model-auth.server";
import { startCallTimer } from "~/services/call-booking.server";

/**
 * POST /api/call/start
 * Start the call timer when both parties are connected
 */
export const action: ActionFunction = async ({ request }) => {
  if (request.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }

  try {
    // Either customer or model can trigger this
    const customerId = await getUserFromSession(request);
    const modelId = await getModelFromSession(request);

    if (!customerId && !modelId) {
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

    const result = await startCallTimer(bookingId);

    return Response.json(result);
  } catch (error: any) {
    console.error("[API] Call start error:", error);
    return Response.json(
      { success: false, error: error.message || "Failed to start call timer" },
      { status: 500 }
    );
  }
};
