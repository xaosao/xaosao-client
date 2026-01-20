import type { ActionFunction } from "react-router";
import { getUserFromSession } from "~/services/auths.server";
import { getModelFromSession } from "~/services/model-auth.server";
import { recordHeartbeat } from "~/services/call-booking.server";

/**
 * POST /api/call/heartbeat
 * Record heartbeat during active call (every 10 seconds)
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
    const { bookingId, participantType } = body;

    if (!bookingId) {
      return Response.json(
        { error: "Booking ID is required" },
        { status: 400 }
      );
    }

    const participantId = customerId || modelId;
    const type = participantType || (customerId ? "customer" : "model");

    const result = await recordHeartbeat(bookingId, participantId!, type);

    return Response.json(result);
  } catch (error: any) {
    console.error("[API] Call heartbeat error:", error);
    return Response.json(
      { success: false, error: error.message || "Failed to record heartbeat" },
      { status: 500 }
    );
  }
};
