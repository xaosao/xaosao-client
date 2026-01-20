import type { ActionFunction, LoaderFunction } from "react-router";
import { getUserFromSession } from "~/services/auths.server";
import { createCallBooking, getCallBooking } from "~/services/call-booking.server";

/**
 * GET /api/call/booking?id=<bookingId>
 * Get call booking details
 */
export const loader: LoaderFunction = async ({ request }) => {
  try {
    const customerId = await getUserFromSession(request);

    if (!customerId) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const url = new URL(request.url);
    const bookingId = url.searchParams.get("id");

    if (!bookingId) {
      return Response.json(
        { error: "Booking ID is required" },
        { status: 400 }
      );
    }

    const booking = await getCallBooking(bookingId);

    if (!booking) {
      return Response.json(
        { error: "Booking not found" },
        { status: 404 }
      );
    }

    // Verify customer owns this booking
    if (booking.customerId !== customerId) {
      return Response.json(
        { error: "Unauthorized" },
        { status: 403 }
      );
    }

    return Response.json({ success: true, booking });
  } catch (error: any) {
    console.error("[API] Get call booking error:", error);
    return Response.json(
      { success: false, error: error.message || "Failed to get booking" },
      { status: 500 }
    );
  }
};

/**
 * POST /api/call/booking
 * Create a new call booking
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
    const { modelServiceId, callType, scheduledTime } = body;

    if (!modelServiceId) {
      return Response.json(
        { error: "Model service ID is required" },
        { status: 400 }
      );
    }

    if (!callType || !["audio", "video"].includes(callType)) {
      return Response.json(
        { error: "Valid call type (audio/video) is required" },
        { status: 400 }
      );
    }

    const result = await createCallBooking({
      customerId,
      modelServiceId,
      callType,
      scheduledTime: scheduledTime ? new Date(scheduledTime) : null,
    });

    return Response.json(result);
  } catch (error: any) {
    console.error("[API] Create call booking error:", error);
    return Response.json(
      { success: false, error: error.message || "Failed to create booking" },
      { status: 500 }
    );
  }
};
