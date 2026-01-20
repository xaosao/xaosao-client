import { prisma } from "./database.server";
import { createAuditLogs } from "./log.server";
import { FieldValidationError } from "./base.server";
import crypto from "crypto";

// ========================================
// Types & Interfaces
// ========================================

export interface CreateCallBookingInput {
  customerId: string;
  modelServiceId: string;
  callType: "audio" | "video";
  scheduledTime?: Date | null; // null = immediate call
}

export interface CallBookingResult {
  success: boolean;
  booking?: any;
  message?: string;
  error?: string;
}

// ========================================
// Helper Functions
// ========================================

/**
 * Generate a unique room ID for WebRTC connection
 */
function generateCallRoomId(): string {
  return `call_${crypto.randomBytes(16).toString("hex")}`;
}

/**
 * Generate a unique peer ID for PeerJS
 */
function generatePeerId(prefix: string): string {
  return `${prefix}_${crypto.randomBytes(8).toString("hex")}`;
}

/**
 * Hold payment from customer wallet for a call booking
 * Holds the entire wallet balance (or max allowed)
 */
async function holdCallPayment(
  customerId: string,
  amount: number,
  bookingId: string
) {
  const wallet = await prisma.wallet.findFirst({
    where: { customerId, status: "active" },
  });

  if (!wallet) {
    throw new FieldValidationError({
      success: false,
      error: true,
      message: "Customer wallet not found!",
    });
  }

  if (wallet.totalBalance < amount) {
    throw new FieldValidationError({
      success: false,
      error: true,
      message: `Insufficient balance! You need at least ${amount.toLocaleString()} LAK for this call.`,
    });
  }

  const holdTransaction = await prisma.transaction_history.create({
    data: {
      identifier: "call_hold",
      amount: -amount,
      status: "held",
      comission: 0,
      fee: 0,
      customerId,
      reason: `Payment held for call booking #${bookingId}`,
    },
  });

  await prisma.wallet.update({
    where: { id: wallet.id },
    data: { totalBalance: wallet.totalBalance - amount },
  });

  return holdTransaction;
}

/**
 * Release payment to model after call ends
 */
async function releaseCallPayment(
  modelId: string,
  amount: number,
  bookingId: string,
  holdTransactionId: string,
  commissionRate: number = 0
) {
  const modelWallet = await prisma.wallet.findFirst({
    where: { modelId, status: "active" },
  });

  // Auto-create wallet if not exists
  let walletId = modelWallet?.id;
  if (!modelWallet) {
    const newWallet = await prisma.wallet.create({
      data: {
        totalBalance: 0,
        totalRecharge: 0,
        totalDeposit: 0,
        status: "active",
        modelId,
      },
    });
    walletId = newWallet.id;
  }

  // Calculate commission and net amount
  const commissionAmount = Math.floor((amount * commissionRate) / 100);
  const netAmount = amount - commissionAmount;

  // Update hold transaction status
  await prisma.transaction_history.update({
    where: { id: holdTransactionId },
    data: { status: "released" },
  });

  // Create earning transaction
  const earningTransaction = await prisma.transaction_history.create({
    data: {
      identifier: "call_earning",
      amount: netAmount,
      status: "approved",
      comission: commissionAmount,
      fee: 0,
      modelId,
      reason: `Earning from call booking #${bookingId} (${commissionRate}% commission: ${commissionAmount.toLocaleString()} LAK)`,
    },
  });

  // Credit model wallet
  const currentWallet = await prisma.wallet.findUnique({ where: { id: walletId } });
  await prisma.wallet.update({
    where: { id: walletId },
    data: {
      totalBalance: (currentWallet?.totalBalance || 0) + netAmount,
      totalDeposit: (currentWallet?.totalDeposit || 0) + netAmount,
    },
  });

  return earningTransaction;
}

/**
 * Refund unused payment back to customer
 */
async function refundCallPayment(
  customerId: string,
  amount: number,
  bookingId: string,
  holdTransactionId: string,
  reason: string
) {
  const wallet = await prisma.wallet.findFirst({
    where: { customerId, status: "active" },
  });

  if (!wallet) {
    throw new FieldValidationError({
      success: false,
      error: true,
      message: "Customer wallet not found!",
    });
  }

  // Update hold transaction status
  await prisma.transaction_history.update({
    where: { id: holdTransactionId },
    data: { status: "refunded" },
  });

  // Create refund transaction
  const refundTransaction = await prisma.transaction_history.create({
    data: {
      identifier: "call_refund",
      amount: amount,
      status: "approved",
      comission: 0,
      fee: 0,
      customerId,
      reason: `Refund for call booking #${bookingId}: ${reason}`,
    },
  });

  // Return money to customer wallet
  await prisma.wallet.update({
    where: { id: wallet.id },
    data: { totalBalance: wallet.totalBalance + amount },
  });

  return refundTransaction;
}

// ========================================
// Main Call Booking Functions
// ========================================

/**
 * Create a new call booking
 * - Validates wallet balance (minimum 1 minute worth)
 * - Holds wallet balance
 * - Creates booking with call-specific fields
 */
export async function createCallBooking(
  input: CreateCallBookingInput
): Promise<CallBookingResult> {
  const { customerId, modelServiceId, callType, scheduledTime } = input;

  try {
    // Get model service with service details
    const modelService = await prisma.model_service.findUnique({
      where: { id: modelServiceId },
      include: {
        service: true,
        model: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            whatsapp: true,
            available_status: true,
          },
        },
      },
    });

    if (!modelService || !modelService.service) {
      throw new FieldValidationError({
        success: false,
        error: true,
        message: "Service not found!",
      });
    }

    // Verify this is a per_minute service
    if (modelService.service.billingType !== "per_minute") {
      throw new FieldValidationError({
        success: false,
        error: true,
        message: "This service does not support call booking!",
      });
    }

    // Get the minute rate (custom or default)
    const minuteRate = modelService.customMinuteRate || modelService.service.minuteRate || 0;
    if (minuteRate <= 0) {
      throw new FieldValidationError({
        success: false,
        error: true,
        message: "Call service rate not configured!",
      });
    }

    // Get customer wallet balance
    const wallet = await prisma.wallet.findFirst({
      where: { customerId, status: "active" },
    });

    if (!wallet) {
      throw new FieldValidationError({
        success: false,
        error: true,
        message: "Customer wallet not found!",
      });
    }

    // Minimum balance required (1 minute)
    const minimumBalance = minuteRate;
    if (wallet.totalBalance < minimumBalance) {
      throw new FieldValidationError({
        success: false,
        error: true,
        message: `Insufficient balance! You need at least ${minimumBalance.toLocaleString()} LAK (1 minute) for this call.`,
      });
    }

    // Calculate hold amount (entire balance, but cap at reasonable maximum)
    const maxHoldMinutes = 120; // Max 2 hours hold
    const maxHoldAmount = minuteRate * maxHoldMinutes;
    const holdAmount = Math.min(wallet.totalBalance, maxHoldAmount);

    // Generate unique IDs
    const callRoomId = generateCallRoomId();
    const customerPeerId = generatePeerId("cust");

    // Create the booking
    const booking = await prisma.service_booking.create({
      data: {
        price: holdAmount, // This will be updated to actual price after call
        location: "Call Service", // Virtual location for calls
        preferredAttire: "", // Not applicable for calls
        startDate: scheduledTime || new Date(),
        status: scheduledTime ? "scheduled" : "ready_to_call",
        paymentStatus: "pending",
        callType,
        callStatus: scheduledTime ? "scheduled" : "ready_to_call",
        callRoomId,
        scheduledCallTime: scheduledTime || null,
        customerPeerId,
        customerId,
        modelId: modelService.modelId,
        modelServiceId,
      },
    });

    // Hold payment
    const holdTransaction = await holdCallPayment(customerId, holdAmount, booking.id);

    // Update booking with hold transaction ID and payment status
    await prisma.service_booking.update({
      where: { id: booking.id },
      data: {
        holdTransactionId: holdTransaction.id,
        paymentStatus: "held",
      },
    });

    // Create audit log
    await createAuditLogs({
      action: "CALL_BOOKING_CREATED",
      customer: customerId,
      description: `Call booking created for model ${modelService.model?.firstName}. Type: ${callType}, Hold: ${holdAmount.toLocaleString()} LAK`,
      status: "success",
      onSuccess: booking,
    });

    // Return booking with additional info
    const bookingWithDetails = await prisma.service_booking.findUnique({
      where: { id: booking.id },
      include: {
        model: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            profile: true,
            whatsapp: true,
          },
        },
        modelService: {
          include: {
            service: true,
          },
        },
      },
    });

    return {
      success: true,
      booking: {
        ...bookingWithDetails,
        minuteRate,
        maxMinutes: Math.floor(holdAmount / minuteRate),
        holdAmount,
      },
    };
  } catch (error: any) {
    console.error("CREATE_CALL_BOOKING_ERROR", error);

    await createAuditLogs({
      action: "CALL_BOOKING_CREATED",
      customer: customerId,
      description: `Failed to create call booking`,
      status: "failed",
      onError: error,
    });

    if (error instanceof FieldValidationError) {
      throw error;
    }

    throw new FieldValidationError({
      success: false,
      error: true,
      message: error.message || "Failed to create call booking!",
    });
  }
}

/**
 * Customer initiates a call
 * - Updates booking status to "ringing"
 * - Generates model peer ID
 * - Should trigger notification to model
 */
export async function initiateCall(
  bookingId: string,
  customerId: string
): Promise<CallBookingResult> {
  try {
    const booking = await prisma.service_booking.findUnique({
      where: { id: bookingId },
      include: {
        model: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            available_status: true,
          },
        },
      },
    });

    if (!booking) {
      throw new FieldValidationError({
        success: false,
        error: true,
        message: "Booking not found!",
      });
    }

    if (booking.customerId !== customerId) {
      throw new FieldValidationError({
        success: false,
        error: true,
        message: "Unauthorized to initiate this call!",
      });
    }

    if (!["ready_to_call", "scheduled"].includes(booking.callStatus || "")) {
      throw new FieldValidationError({
        success: false,
        error: true,
        message: `Cannot initiate call with status: ${booking.callStatus}`,
      });
    }

    // Generate model peer ID
    const modelPeerId = generatePeerId("model");

    // Update booking to ringing state
    const updatedBooking = await prisma.service_booking.update({
      where: { id: bookingId },
      data: {
        callStatus: "ringing",
        modelPeerId,
      },
    });

    await createAuditLogs({
      action: "CALL_INITIATED",
      customer: customerId,
      model: booking.modelId || undefined,
      description: `Customer initiated call to model ${booking.model?.firstName}`,
      status: "success",
      onSuccess: updatedBooking,
    });

    // TODO: Send push notification to model here
    // await notifyIncomingCall(booking.modelId, bookingId, customerId);

    return {
      success: true,
      booking: {
        ...updatedBooking,
        modelPeerId,
      },
    };
  } catch (error: any) {
    console.error("INITIATE_CALL_ERROR", error);

    if (error instanceof FieldValidationError) {
      throw error;
    }

    throw new FieldValidationError({
      success: false,
      error: true,
      message: error.message || "Failed to initiate call!",
    });
  }
}

/**
 * Model accepts an incoming call
 * - Updates booking status to "connecting"
 * - Returns customer peer ID for WebRTC connection
 */
export async function acceptCall(
  bookingId: string,
  modelId: string
): Promise<CallBookingResult> {
  try {
    const booking = await prisma.service_booking.findUnique({
      where: { id: bookingId },
    });

    if (!booking) {
      throw new FieldValidationError({
        success: false,
        error: true,
        message: "Booking not found!",
      });
    }

    if (booking.modelId !== modelId) {
      throw new FieldValidationError({
        success: false,
        error: true,
        message: "Unauthorized to accept this call!",
      });
    }

    if (booking.callStatus !== "ringing") {
      throw new FieldValidationError({
        success: false,
        error: true,
        message: `Cannot accept call with status: ${booking.callStatus}`,
      });
    }

    // Update to connecting state
    const updatedBooking = await prisma.service_booking.update({
      where: { id: bookingId },
      data: {
        callStatus: "connecting",
        status: "confirmed",
      },
    });

    await createAuditLogs({
      action: "CALL_ACCEPTED",
      model: modelId,
      customer: booking.customerId || undefined,
      description: `Model accepted incoming call`,
      status: "success",
      onSuccess: updatedBooking,
    });

    return {
      success: true,
      booking: updatedBooking,
    };
  } catch (error: any) {
    console.error("ACCEPT_CALL_ERROR", error);

    if (error instanceof FieldValidationError) {
      throw error;
    }

    throw new FieldValidationError({
      success: false,
      error: true,
      message: error.message || "Failed to accept call!",
    });
  }
}

/**
 * Start the call timer (called when both parties are connected)
 * - Records call start time
 * - Updates status to "in_call"
 */
export async function startCallTimer(bookingId: string): Promise<CallBookingResult> {
  try {
    const booking = await prisma.service_booking.findUnique({
      where: { id: bookingId },
    });

    if (!booking) {
      throw new FieldValidationError({
        success: false,
        error: true,
        message: "Booking not found!",
      });
    }

    if (booking.callStatus !== "connecting") {
      throw new FieldValidationError({
        success: false,
        error: true,
        message: `Cannot start timer with status: ${booking.callStatus}`,
      });
    }

    const now = new Date();
    const updatedBooking = await prisma.service_booking.update({
      where: { id: bookingId },
      data: {
        callStatus: "in_call",
        status: "in_progress",
        callStartedAt: now,
        callLastHeartbeat: now,
      },
    });

    await createAuditLogs({
      action: "CALL_STARTED",
      customer: booking.customerId || undefined,
      model: booking.modelId || undefined,
      description: `Call started at ${now.toISOString()}`,
      status: "success",
      onSuccess: updatedBooking,
    });

    return {
      success: true,
      booking: updatedBooking,
    };
  } catch (error: any) {
    console.error("START_CALL_TIMER_ERROR", error);

    if (error instanceof FieldValidationError) {
      throw error;
    }

    throw new FieldValidationError({
      success: false,
      error: true,
      message: error.message || "Failed to start call timer!",
    });
  }
}

/**
 * Record heartbeat during call
 * - Updates last heartbeat timestamp
 * - Used for tracking call duration in case of disconnection
 */
export async function recordHeartbeat(
  bookingId: string,
  participantId: string,
  participantType: "customer" | "model"
): Promise<{ success: boolean; currentDuration: number; remainingBalance: number }> {
  try {
    const booking = await prisma.service_booking.findUnique({
      where: { id: bookingId },
      include: {
        modelService: {
          include: { service: true },
        },
      },
    });

    if (!booking) {
      throw new FieldValidationError({
        success: false,
        error: true,
        message: "Booking not found!",
      });
    }

    // Verify participant
    if (participantType === "customer" && booking.customerId !== participantId) {
      throw new FieldValidationError({
        success: false,
        error: true,
        message: "Unauthorized!",
      });
    }
    if (participantType === "model" && booking.modelId !== participantId) {
      throw new FieldValidationError({
        success: false,
        error: true,
        message: "Unauthorized!",
      });
    }

    if (booking.callStatus !== "in_call") {
      throw new FieldValidationError({
        success: false,
        error: true,
        message: "Call is not active!",
      });
    }

    // Update heartbeat
    await prisma.service_booking.update({
      where: { id: bookingId },
      data: { callLastHeartbeat: new Date() },
    });

    // Calculate current duration and remaining balance
    const startTime = booking.callStartedAt || new Date();
    const currentDurationSeconds = Math.floor((Date.now() - startTime.getTime()) / 1000);
    const currentDurationMinutes = Math.ceil(currentDurationSeconds / 60);

    const minuteRate = booking.modelService?.customMinuteRate ||
                       booking.modelService?.service?.minuteRate || 0;
    const currentCost = currentDurationMinutes * minuteRate;
    const holdAmount = booking.price; // The held amount
    const remainingBalance = holdAmount - currentCost;

    return {
      success: true,
      currentDuration: currentDurationSeconds,
      remainingBalance: Math.max(0, remainingBalance),
    };
  } catch (error: any) {
    console.error("RECORD_HEARTBEAT_ERROR", error);
    throw error;
  }
}

/**
 * End the call and process payment
 * - Calculates actual duration (rounded up, min 1 minute)
 * - Releases payment to model (actual cost)
 * - Refunds unused balance to customer
 */
export async function endCall(
  bookingId: string,
  endedBy: "customer" | "model" | "system"
): Promise<CallBookingResult> {
  try {
    const booking = await prisma.service_booking.findUnique({
      where: { id: bookingId },
      include: {
        modelService: {
          include: { service: true },
        },
        model: {
          select: { id: true, firstName: true },
        },
        customer: {
          select: { id: true, firstName: true },
        },
      },
    });

    if (!booking) {
      throw new FieldValidationError({
        success: false,
        error: true,
        message: "Booking not found!",
      });
    }

    if (!["in_call", "ringing", "connecting"].includes(booking.callStatus || "")) {
      throw new FieldValidationError({
        success: false,
        error: true,
        message: `Cannot end call with status: ${booking.callStatus}`,
      });
    }

    const now = new Date();
    const startTime = booking.callStartedAt || now;

    // Calculate duration in seconds, then round up to minutes (minimum 1 minute)
    const durationSeconds = Math.max(0, Math.floor((now.getTime() - startTime.getTime()) / 1000));
    const durationMinutes = Math.max(1, Math.ceil(durationSeconds / 60)); // Minimum 1 minute charge

    // Get rate and calculate costs
    const minuteRate = booking.modelService?.customMinuteRate ||
                       booking.modelService?.service?.minuteRate || 0;
    const commissionRate = booking.modelService?.service?.commission || 0;
    const actualCost = durationMinutes * minuteRate;
    const holdAmount = booking.price;
    const refundAmount = Math.max(0, holdAmount - actualCost);

    // Update booking with final details
    const updatedBooking = await prisma.service_booking.update({
      where: { id: bookingId },
      data: {
        callStatus: "completed",
        status: "completed",
        callEndedAt: now,
        minutes: durationMinutes,
        price: actualCost, // Update to actual price
        completedAt: now,
      },
    });

    // Release payment to model
    if (booking.modelId && booking.holdTransactionId) {
      await releaseCallPayment(
        booking.modelId,
        actualCost,
        bookingId,
        booking.holdTransactionId,
        commissionRate
      );
    }

    // Refund unused balance to customer
    if (refundAmount > 0 && booking.customerId && booking.holdTransactionId) {
      // Create a separate refund transaction for the unused portion
      const customerWallet = await prisma.wallet.findFirst({
        where: { customerId: booking.customerId, status: "active" },
      });

      if (customerWallet) {
        await prisma.transaction_history.create({
          data: {
            identifier: "call_refund_unused",
            amount: refundAmount,
            status: "approved",
            comission: 0,
            fee: 0,
            customerId: booking.customerId,
            reason: `Unused balance refund for call #${bookingId} (${durationMinutes} minutes used)`,
          },
        });

        await prisma.wallet.update({
          where: { id: customerWallet.id },
          data: { totalBalance: customerWallet.totalBalance + refundAmount },
        });
      }
    }

    await createAuditLogs({
      action: "CALL_ENDED",
      customer: booking.customerId || undefined,
      model: booking.modelId || undefined,
      description: `Call ended by ${endedBy}. Duration: ${durationMinutes} min, Cost: ${actualCost.toLocaleString()} LAK, Refund: ${refundAmount.toLocaleString()} LAK`,
      status: "success",
      onSuccess: updatedBooking,
    });

    return {
      success: true,
      booking: {
        ...updatedBooking,
        durationMinutes,
        actualCost,
        refundAmount,
        endedBy,
      },
    };
  } catch (error: any) {
    console.error("END_CALL_ERROR", error);

    if (error instanceof FieldValidationError) {
      throw error;
    }

    throw new FieldValidationError({
      success: false,
      error: true,
      message: error.message || "Failed to end call!",
    });
  }
}

/**
 * Handle missed call (model didn't answer within timeout)
 * - Full refund to customer
 * - Updates status to "missed"
 */
export async function handleMissedCall(bookingId: string): Promise<CallBookingResult> {
  try {
    const booking = await prisma.service_booking.findUnique({
      where: { id: bookingId },
    });

    if (!booking) {
      throw new FieldValidationError({
        success: false,
        error: true,
        message: "Booking not found!",
      });
    }

    if (booking.callStatus !== "ringing") {
      throw new FieldValidationError({
        success: false,
        error: true,
        message: `Cannot mark as missed with status: ${booking.callStatus}`,
      });
    }

    // Update booking status
    const updatedBooking = await prisma.service_booking.update({
      where: { id: bookingId },
      data: {
        callStatus: "missed",
        status: "cancelled",
        callEndedAt: new Date(),
      },
    });

    // Full refund to customer
    if (booking.customerId && booking.holdTransactionId) {
      await refundCallPayment(
        booking.customerId,
        booking.price,
        bookingId,
        booking.holdTransactionId,
        "Model did not answer"
      );
    }

    await createAuditLogs({
      action: "CALL_MISSED",
      customer: booking.customerId || undefined,
      model: booking.modelId || undefined,
      description: `Call missed - model did not answer. Full refund: ${booking.price.toLocaleString()} LAK`,
      status: "success",
      onSuccess: updatedBooking,
    });

    return {
      success: true,
      booking: updatedBooking,
      message: "Call was not answered. Full refund has been processed.",
    };
  } catch (error: any) {
    console.error("HANDLE_MISSED_CALL_ERROR", error);

    if (error instanceof FieldValidationError) {
      throw error;
    }

    throw new FieldValidationError({
      success: false,
      error: true,
      message: error.message || "Failed to process missed call!",
    });
  }
}

/**
 * Decline an incoming call (by model)
 * - Full refund to customer
 * - Updates status to "cancelled"
 */
export async function declineCall(
  bookingId: string,
  modelId: string
): Promise<CallBookingResult> {
  try {
    const booking = await prisma.service_booking.findUnique({
      where: { id: bookingId },
    });

    if (!booking) {
      throw new FieldValidationError({
        success: false,
        error: true,
        message: "Booking not found!",
      });
    }

    if (booking.modelId !== modelId) {
      throw new FieldValidationError({
        success: false,
        error: true,
        message: "Unauthorized to decline this call!",
      });
    }

    if (booking.callStatus !== "ringing") {
      throw new FieldValidationError({
        success: false,
        error: true,
        message: `Cannot decline call with status: ${booking.callStatus}`,
      });
    }

    // Update booking status
    const updatedBooking = await prisma.service_booking.update({
      where: { id: bookingId },
      data: {
        callStatus: "cancelled",
        status: "rejected",
        callEndedAt: new Date(),
        rejectReason: "Model declined the call",
      },
    });

    // Full refund to customer
    if (booking.customerId && booking.holdTransactionId) {
      await refundCallPayment(
        booking.customerId,
        booking.price,
        bookingId,
        booking.holdTransactionId,
        "Model declined the call"
      );
    }

    await createAuditLogs({
      action: "CALL_DECLINED",
      model: modelId,
      customer: booking.customerId || undefined,
      description: `Model declined incoming call. Full refund: ${booking.price.toLocaleString()} LAK`,
      status: "success",
      onSuccess: updatedBooking,
    });

    return {
      success: true,
      booking: updatedBooking,
      message: "Call declined. Customer has been refunded.",
    };
  } catch (error: any) {
    console.error("DECLINE_CALL_ERROR", error);

    if (error instanceof FieldValidationError) {
      throw error;
    }

    throw new FieldValidationError({
      success: false,
      error: true,
      message: error.message || "Failed to decline call!",
    });
  }
}

/**
 * Get call booking details with computed fields
 */
export async function getCallBooking(bookingId: string) {
  const booking = await prisma.service_booking.findUnique({
    where: { id: bookingId },
    include: {
      model: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          profile: true,
          whatsapp: true,
          available_status: true,
        },
      },
      customer: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          profile: true,
        },
      },
      modelService: {
        include: {
          service: true,
        },
      },
    },
  });

  if (!booking) {
    return null;
  }

  // Calculate computed fields
  const minuteRate = booking.modelService?.customMinuteRate ||
                     booking.modelService?.service?.minuteRate || 0;

  let currentDuration = 0;
  let currentCost = 0;
  let remainingBalance = booking.price;

  if (booking.callStartedAt && booking.callStatus === "in_call") {
    currentDuration = Math.floor((Date.now() - booking.callStartedAt.getTime()) / 1000);
    const currentMinutes = Math.ceil(currentDuration / 60);
    currentCost = currentMinutes * minuteRate;
    remainingBalance = Math.max(0, booking.price - currentCost);
  }

  return {
    ...booking,
    minuteRate,
    currentDuration,
    currentCost,
    remainingBalance,
    maxMinutes: Math.floor(booking.price / minuteRate),
  };
}

/**
 * Get customer's call history
 */
export async function getCustomerCallHistory(customerId: string) {
  return prisma.service_booking.findMany({
    where: {
      customerId,
      callType: { not: null }, // Only call bookings
    },
    include: {
      model: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          profile: true,
        },
      },
      modelService: {
        include: {
          service: {
            select: {
              name: true,
              minuteRate: true,
            },
          },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });
}

/**
 * Get model's call history
 */
export async function getModelCallHistory(modelId: string) {
  return prisma.service_booking.findMany({
    where: {
      modelId,
      callType: { not: null }, // Only call bookings
    },
    include: {
      customer: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          profile: true,
        },
      },
      modelService: {
        include: {
          service: {
            select: {
              name: true,
              minuteRate: true,
            },
          },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });
}
