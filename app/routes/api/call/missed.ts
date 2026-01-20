import type { ActionFunction } from "react-router";
import { getUserFromSession } from "~/services/auths.server";
import { handleMissedCall } from "~/services/call-booking.server";

/**
 * POST /api/call/missed
 * Handle missed call (model didn't answer within timeout)
 */
export const action: ActionFunction = async ({ request }) => {
  if (request.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }

  try {
    const customerId = await getUserFromSession(request);

    if (!customerId) {
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

    const result = await handleMissedCall(bookingId);

    return Response.json(result);
  } catch (error: any) {
    console.error("[API] Call missed error:", error);
    return Response.json(
      { success: false, error: error.message || "Failed to handle missed call" },
      { status: 500 }
    );
  }
};
