import type { ActionFunction } from "react-router";
import { getUserFromSession } from "~/services/auths.server";
import { initiateCall } from "~/services/call-booking.server";

/**
 * POST /api/call/initiate
 * Customer initiates a call to model
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

    const result = await initiateCall(bookingId, customerId);

    return Response.json(result);
  } catch (error: any) {
    console.error("[API] Call initiate error:", error);
    return Response.json(
      { success: false, error: error.message || "Failed to initiate call" },
      { status: 500 }
    );
  }
};
