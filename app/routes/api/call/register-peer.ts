import type { ActionFunction } from "react-router";
import { getUserFromSession } from "~/services/auths.server";
import { getModelFromSession } from "~/services/model-auth.server";
import { prisma } from "~/services/database.server";

/**
 * POST /api/call/register-peer
 * Register a peer ID for a booking participant
 */
export const action: ActionFunction = async ({ request }) => {
  if (request.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }

  try {
    const body = await request.json();
    const { bookingId, peerId, participantType } = body;

    if (!bookingId || !peerId || !participantType) {
      return Response.json(
        { error: "bookingId, peerId, and participantType are required" },
        { status: 400 }
      );
    }

    // Verify user is authorized
    let userId: string | null = null;
    if (participantType === "customer") {
      userId = await getUserFromSession(request);
    } else if (participantType === "model") {
      userId = await getModelFromSession(request);
    }

    if (!userId) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify booking exists and user has access
    const booking = await prisma.service_booking.findUnique({
      where: { id: bookingId },
    });

    if (!booking) {
      return Response.json({ error: "Booking not found" }, { status: 404 });
    }

    // Verify user owns this booking
    if (participantType === "customer" && booking.customerId !== userId) {
      return Response.json({ error: "Unauthorized" }, { status: 403 });
    }
    if (participantType === "model" && booking.modelId !== userId) {
      return Response.json({ error: "Unauthorized" }, { status: 403 });
    }

    // Update the appropriate peer ID
    const updateData =
      participantType === "customer"
        ? { customerPeerId: peerId }
        : { modelPeerId: peerId };

    const updatedBooking = await prisma.service_booking.update({
      where: { id: bookingId },
      data: updateData,
    });

    console.log(
      `[API] Peer registered: ${participantType} ${peerId} for booking ${bookingId}`
    );

    return Response.json({
      success: true,
      booking: {
        id: updatedBooking.id,
        customerPeerId: updatedBooking.customerPeerId,
        modelPeerId: updatedBooking.modelPeerId,
      },
    });
  } catch (error: any) {
    console.error("[API] Register peer error:", error);
    return Response.json(
      { success: false, error: error.message || "Failed to register peer" },
      { status: 500 }
    );
  }
};
