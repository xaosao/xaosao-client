import { prisma } from "./database.server";
import { createAuditLogs } from "./log.server";
import { FieldValidationError } from "./base.server";
import type { IServiceBookingCredentials } from "~/interfaces/service";
import {
  notifyBookingCreated,
  notifyBookingConfirmed,
  notifyBookingRejected,
  notifyBookingCancelled,
  notifyModelCheckedIn,
  notifyCustomerCheckedIn,
  notifyBookingCompleted,
  notifyCompletionConfirmed,
  notifyBookingDisputed,
  notifyPaymentRefunded,
  notifyAutoReleasePayment,
  notifyBookingEdited,
} from "./notification.server";

import crypto from "crypto";

// ========================================
// Token Generation Helper Functions
// ========================================

/**
 * Generate a unique completion token for QR-based confirmation
 * Format: prefix_randomBytes (e.g., "xao_a1b2c3d4e5f6...")
 */
function generateCompletionToken(): string {
  const randomPart = crypto.randomBytes(24).toString("base64url");
  return `xao_${randomPart}`;
}

// ========================================
// GPS & Location Helper Functions
// ========================================

/**
 * Calculate distance between two GPS coordinates using Haversine formula
 * @returns Distance in kilometers
 */
function calculateDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371; // Earth's radius in kilometers
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Check if user is within acceptable radius of booking location
 * @param userLat User's current latitude
 * @param userLng User's current longitude
 * @param bookingLat Booking location latitude
 * @param bookingLng Booking location longitude
 * @param radiusKm Acceptable radius in kilometers (default 0.05km = 50m)
 */
export function isWithinCheckInRadius(
  userLat: number,
  userLng: number,
  bookingLat: number,
  bookingLng: number,
  radiusKm: number = 0.05
): { isWithin: boolean; distance: number } {
  const distance = calculateDistance(userLat, userLng, bookingLat, bookingLng);
  return {
    isWithin: distance <= radiusKm,
    distance: Math.round(distance * 1000), // Convert to meters
  };
}

/**
 * Check if booking time is within check-in window
 * Can check in from 30 minutes before start time until end of booking
 */
export function isWithinCheckInTimeWindow(
  startDate: Date,
  endDate?: Date | null
): { canCheckIn: boolean; message: string } {
  const now = new Date();
  const bookingStart = new Date(startDate);
  const checkInWindowStart = new Date(bookingStart.getTime() - 30 * 60 * 1000); // 30 min before

  if (now < checkInWindowStart) {
    const minutesUntil = Math.ceil(
      (checkInWindowStart.getTime() - now.getTime()) / (1000 * 60)
    );
    return {
      canCheckIn: false,
      message: `Check-in opens ${minutesUntil} minutes before the booking starts.`,
    };
  }

  // If there's an end date, check if we're past it
  if (endDate) {
    const bookingEnd = new Date(endDate);
    if (now > bookingEnd) {
      return {
        canCheckIn: false,
        message: "This booking has already ended.",
      };
    }
  }

  return { canCheckIn: true, message: "" };
}

// ========================================
// Escrow Payment Helper Functions
// ========================================

/**
 * Hold payment from customer wallet for a booking
 */
async function holdPaymentFromCustomer(
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
      message: `Insufficient balance! You need ${amount.toLocaleString()} LAK but have ${wallet.totalBalance.toLocaleString()} LAK.`,
    });
  }

  const holdTransaction = await prisma.transaction_history.create({
    data: {
      identifier: "booking_hold",
      amount: -amount,
      status: "held",
      comission: 0,
      fee: 0,
      customerId,
      reason: `Payment held for booking #${bookingId}`,
    },
  });

  await prisma.wallet.update({
    where: { id: wallet.id },
    data: { totalBalance: wallet.totalBalance - amount },
  });

  return holdTransaction;
}

/**
 * Release held payment to model wallet
 */
async function releasePaymentToModel(
  modelId: string,
  amount: number,
  bookingId: string,
  holdTransactionId: string,
  commissionRate: number = 0 // Commission rate as percentage (e.g., 10 for 10%)
) {
  const modelWallet = await prisma.wallet.findFirst({
    where: { modelId, status: "active" },
  });

  if (!modelWallet) {
    throw new FieldValidationError({
      success: false,
      error: true,
      message: "Model wallet not found!",
    });
  }

  // Calculate commission and net amount
  const commissionAmount = Math.floor((amount * commissionRate) / 100);
  const netAmount = amount - commissionAmount;

  await prisma.transaction_history.update({
    where: { id: holdTransactionId },
    data: { status: "released" },
  });

  const earningTransaction = await prisma.transaction_history.create({
    data: {
      identifier: "booking_earning",
      amount: netAmount,
      status: "approved",
      comission: commissionAmount,
      fee: 0,
      modelId,
      reason: `Earning from completed booking #${bookingId} (${commissionRate}% commission: ${commissionAmount.toLocaleString()} LAK)`,
    },
  });

  await prisma.wallet.update({
    where: { id: modelWallet.id },
    data: {
      totalBalance: modelWallet.totalBalance + netAmount,
      totalDeposit: modelWallet.totalDeposit + netAmount,
    },
  });

  return earningTransaction;
}

/**
 * Refund held payment back to customer
 */
async function refundPaymentToCustomer(
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

  await prisma.transaction_history.update({
    where: { id: holdTransactionId },
    data: { status: "refunded" },
  });

  const refundTransaction = await prisma.transaction_history.create({
    data: {
      identifier: "booking_refund",
      amount: amount,
      status: "approved",
      comission: 0,
      fee: 0,
      customerId,
      reason: `Refund for booking #${bookingId}: ${reason}`,
    },
  });

  await prisma.wallet.update({
    where: { id: wallet.id },
    data: { totalBalance: wallet.totalBalance + amount },
  });

  return refundTransaction;
}

/**
 * Check if booking can be cancelled (2 hours before start time rule)
 */
export function canCancelBooking(startDate: Date): { canCancel: boolean; message: string } {
  const now = new Date();
  const bookingStart = new Date(startDate);
  const hoursUntilBooking = (bookingStart.getTime() - now.getTime()) / (1000 * 60 * 60);

  if (hoursUntilBooking < 2) {
    return {
      canCancel: false,
      message: "Cannot cancel within 2 hours of booking start time. Please contact support.",
    };
  }

  return { canCancel: true, message: "" };
}

// ========================================
// Booking CRUD Functions
// ========================================

export async function createServiceBooking(
  customerId: string,
  modelId: string,
  modelServiceId: string,
  data: IServiceBookingCredentials
) {
  const auditBase = {
    action: "CREATE_SERVICE_BOOKING",
    customer: customerId,
  };

  try {
    // First, hold the payment from customer wallet
    const holdTransaction = await holdPaymentFromCustomer(customerId, data.price, "pending");

    // Create booking with payment held
    const result = await prisma.service_booking.create({
      data: {
        price: data.price,
        dayAmount: data.dayAmount,
        location: data.location,
        preferredAttire: data.preferred ?? "",
        startDate: data.startDate,
        endDate: data.endDate,
        status: "pending",
        paymentStatus: "held",
        holdTransactionId: holdTransaction.id,
        customerId,
        modelId,
        modelServiceId,
      },
    });

    // Update transaction with actual booking ID
    await prisma.transaction_history.update({
      where: { id: holdTransaction.id },
      data: { reason: `Payment held for booking #${result.id}` },
    });

    if (result.id) {
      await createAuditLogs({
        ...auditBase,
        description: `Create service booking: ${result.id} with payment held successfully.`,
        status: "success",
        onSuccess: result,
      });

      // Send notification to model (including SMS)
      try {
        const customer = await prisma.customer.findUnique({
          where: { id: customerId },
          select: { firstName: true },
        });
        const modelService = await prisma.model_service.findUnique({
          where: { id: modelServiceId },
          include: { service: true },
        });
        if (customer && modelService?.service) {
          await notifyBookingCreated(
            modelId,
            customerId,
            result.id,
            modelService.service.name,
            customer.firstName,
            data.startDate,
            data.location,
            data.price
          );
        }
      } catch (notifyError) {
        console.error("NOTIFY_BOOKING_CREATED_FAILED", notifyError);
      }
    }
    return result;
  } catch (error) {
    console.error("CREATE_SERVICE_BOOKING_FAILED", error);
    await createAuditLogs({
      ...auditBase,
      description: `Create service booking failed!`,
      status: "failed",
      onError: error,
    });

    if (error instanceof FieldValidationError) {
      throw error;
    }

    throw new FieldValidationError({
      success: false,
      error: true,
      message: "Failed to create service booking!",
    });
  }
}

export async function updateServiceBooking(
  id: string,
  customerId: string,
  data: IServiceBookingCredentials
) {
  const auditBase = {
    action: "UPDATE_SERVICE_BOOKING",
    customer: customerId,
  };

  try {
    const result = await prisma.service_booking.update({
      where: {
        id,
      },
      data: {
        price: data.price,
        dayAmount: data.dayAmount,
        location: data.location,
        preferredAttire: data.preferred ?? "",
        startDate: data.startDate,
        endDate: data.endDate,
      },
      include: {
        model: { select: { id: true } },
        modelService: { include: { service: true } },
      },
    });

    if (result.id) {
      await createAuditLogs({
        ...auditBase,
        description: `Update service booking: ${result.id} successfully.`,
        status: "success",
        onSuccess: result,
      });

      // Send notification to model (including SMS)
      try {
        const customer = await prisma.customer.findUnique({
          where: { id: customerId },
          select: { firstName: true },
        });
        if (customer && result.model?.id && result.modelService?.service) {
          await notifyBookingEdited(
            result.model.id,
            customerId,
            result.id,
            result.modelService.service.name,
            customer.firstName,
            data.startDate,
            data.location,
            data.price
          );
        }
      } catch (notifyError) {
        console.error("NOTIFY_BOOKING_EDITED_FAILED", notifyError);
      }
    }
    return result;
  } catch (error) {
    console.error("UPDATE_SERVICE_BOOKING_FAILED", error);
    await createAuditLogs({
      ...auditBase,
      description: `Update service booking failed!`,
      status: "failed",
      onError: error,
    });
    throw new FieldValidationError({
      success: false,
      error: true,
      message: "Failed to update service booking!",
    });
  }
}

// export async function getAllMyServiceBookings(customerId: string) {
//   try {
//     return await prisma.service_booking.findMany({
//       where: {
//         customerId,
//       },
//       take: 20,
//       select: {
//         id: true,
//         price: true,
//         location: true,
//         preferredAttire: true,
//         startDate: true,
//         endDate: true,
//         status: true,
//         dayAmount: true,
//         model: {
//           select: {
//             id: true,
//             firstName: true,
//             lastName: true,
//             profile: true,
//             dob: true,
//             friend_contacts: {
//               where: {
//                 adderType: "CUSTOMER",
//                 customerId: customerId,
//                 contactType: "MODEL",
//               },
//               select: {
//                 id: true,
//                 modelId: true,
//                 contactType: true,
//               },
//             },
//           },
//         },
//         modelService: {
//           select: {
//             id: true,
//             customRate: true,
//             service: {
//               select: {
//                 id: true,
//                 name: true,
//                 description: true,
//                 baseRate: true,
//               },
//             },
//           },
//         },
//       },
//     });
//   } catch (error: any) {
//     console.error("GET_ALL_MY_SERVICE_BOOKING", error);
//     throw new Error("Failed to query service booking!");
//   }
// }
export async function getAllMyServiceBookings(customerId: string) {
  try {
    const bookings = await prisma.service_booking.findMany({
      where: {
        customerId,
      },
      take: 20,
      select: {
        id: true,
        price: true,
        location: true,
        preferredAttire: true,
        startDate: true,
        endDate: true,
        status: true,
        dayAmount: true,
        completionToken: true,
        model: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            profile: true,
            dob: true,
            whatsapp: true,
            friend_contacts: {
              where: {
                adderType: "CUSTOMER",
                customerId,
                contactType: "MODEL",
              },
              select: {
                id: true,
                modelId: true,
                contactType: true,
              },
            },
          },
        },
        modelService: {
          select: {
            id: true,
            customRate: true,
            service: {
              select: {
                id: true,
                name: true,
                description: true,
                baseRate: true,
              },
            },
          },
        },
      },
    });

    // 🧠 Add computed field
    return bookings.map((booking) => ({
      ...booking,
      isContact: !!booking.model?.friend_contacts?.length,
    }));
  } catch (error: any) {
    console.error("GET_ALL_MY_SERVICE_BOOKING", error);
    throw new Error("Failed to query service booking!");
  }
}

export async function getAllMyServiceBooking(id: string) {
  try {
    return await prisma.service_booking.findFirst({
      where: {
        id,
      },
      select: {
        id: true,
        price: true,
        location: true,
        preferredAttire: true,
        startDate: true,
        endDate: true,
        status: true,
        dayAmount: true,
        modelId: true,
        modelServiceId: true,
      },
    });
  } catch (error: any) {
    console.error("GET_MY_SERVICE_BOOKING", error);
    throw new Error("Failed to query service booking!");
  }
}

export async function getMyServiceBookingDetail(id: string) {
  try {
    return await prisma.service_booking.findFirst({
      where: {
        id,
      },
      select: {
        id: true,
        price: true,
        location: true,
        preferredAttire: true,
        startDate: true,
        endDate: true,
        status: true,
        dayAmount: true,
        model: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            dob: true,
            profile: true,
          },
        },
        modelService: {
          select: {
            id: true,
            service: {
              select: {
                id: true,
                name: true,
                description: true,
                baseRate: true,
              },
            },
          },
        },
      },
    });
  } catch (error: any) {
    console.error("GET_MY_SERVICE_BOOKING", error);
    throw new Error("Failed to query service booking!");
  }
}

export async function deleteServiceBooking(id: string, customerId: string) {
  if (!id) throw new Error("Missing service booking id!");
  if (!customerId) throw new Error("Missing customer id!");

  const auditBase = {
    action: "DELETE_SERVICE_BOOKING",
    customer: customerId,
  };

  try {
    const booking = await prisma.service_booking.findUnique({
      where: {
        id,
      },
    });

    if (!booking) {
      throw new FieldValidationError({
        success: false,
        error: true,
        message: "The service booking does not exist!",
      });
    }

    if (booking.customerId !== customerId) {
      throw new FieldValidationError({
        success: false,
        error: true,
        message: "Unauthorized to delete this date booking!",
      });
    }

    if (booking.status == "pending") {
      throw new FieldValidationError({
        success: false,
        error: true,
        message:
          "This date booking can't be deleted. Please contect admin to process!",
      });
    }

    const deletedServiceBooking = await prisma.service_booking.delete({
      where: {
        id,
        customerId: customerId,
      },
    });

    if (deletedServiceBooking.id) {
      await createAuditLogs({
        ...auditBase,
        description: `Delete service booking: ${deletedServiceBooking.id} successfully.`,
        status: "success",
        onSuccess: deletedServiceBooking,
      });
    }
    return deletedServiceBooking;
  } catch (error) {
    console.error("DELETE_SERVICE_BOOKING_FAILED", error);
    await createAuditLogs({
      ...auditBase,
      description: `Delete service booking failed!`,
      status: "failed",
      onError: error,
    });
    throw new FieldValidationError({
      success: false,
      error: true,
      message: "Failed to delete service booking!",
    });
  }
}

export async function cancelServiceBooking(id: string, customerId: string) {
  if (!id) throw new Error("Missing service booking id!");
  if (!customerId) throw new Error("Missing customer id!");

  const auditBase = {
    action: "CANCEL_SERVICE_BOOKING",
    customer: customerId,
  };

  try {
    const booking = await prisma.service_booking.findUnique({
      where: { id },
    });

    if (!booking) {
      throw new FieldValidationError({
        success: false,
        error: true,
        message: "The service booking does not exist!",
      });
    }

    if (booking.customerId !== customerId) {
      throw new FieldValidationError({
        success: false,
        error: true,
        message: "Unauthorized to cancel this date booking!",
      });
    }

    // Only pending or confirmed bookings can be cancelled
    if (booking.status !== "pending" && booking.status !== "confirmed") {
      throw new FieldValidationError({
        success: false,
        error: true,
        message: "This booking cannot be cancelled. Please contact support.",
      });
    }

    // Check 2-hour cancellation rule
    const cancelCheck = canCancelBooking(booking.startDate);
    if (!cancelCheck.canCancel) {
      throw new FieldValidationError({
        success: false,
        error: true,
        message: cancelCheck.message,
      });
    }

    // Refund payment if held
    if (booking.paymentStatus === "held" && booking.holdTransactionId) {
      await refundPaymentToCustomer(
        customerId,
        booking.price,
        booking.id,
        booking.holdTransactionId,
        "Booking cancelled by customer"
      );
    }

    const cancelledBooking = await prisma.service_booking.update({
      where: { id, customerId },
      data: {
        status: "cancelled",
        paymentStatus: "refunded",
      },
    });

    if (cancelledBooking.id) {
      await createAuditLogs({
        ...auditBase,
        description: `Cancel service booking: ${cancelledBooking.id} with refund successfully.`,
        status: "success",
        onSuccess: cancelledBooking,
      });

      // Send notification to model (including SMS)
      try {
        const customer = await prisma.customer.findUnique({
          where: { id: customerId },
          select: { firstName: true },
        });
        const bookingWithService = await prisma.service_booking.findUnique({
          where: { id },
          include: { modelService: { include: { service: true } } },
        });
        if (customer && bookingWithService && booking.modelId && bookingWithService.modelService?.service) {
          await notifyBookingCancelled(
            booking.modelId,
            customerId,
            id,
            bookingWithService.modelService.service.name,
            customer.firstName,
            booking.startDate
          );
        }
      } catch (notifyError) {
        console.error("NOTIFY_BOOKING_CANCELLED_FAILED", notifyError);
      }
    }
    return cancelledBooking;
  } catch (error) {
    console.error("CANCEL_SERVICE_BOOKING_FAILED", error);
    await createAuditLogs({
      ...auditBase,
      description: `Cancel service booking failed!`,
      status: "failed",
      onError: error,
    });

    if (error instanceof FieldValidationError) {
      throw error;
    }

    throw new FieldValidationError({
      success: false,
      error: true,
      message: "Failed to cancel service booking!",
    });
  }
}

// ========================================
// Model Dating / Booking Functions
// ========================================

/**
 * Get all bookings for a model
 */
export async function getAllModelBookings(modelId: string) {
  try {
    const bookings = await prisma.service_booking.findMany({
      where: {
        modelId,
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 50,
      select: {
        id: true,
        price: true,
        location: true,
        preferredAttire: true,
        startDate: true,
        endDate: true,
        status: true,
        dayAmount: true,
        createdAt: true,
        modelCheckedInAt: true,
        customer: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            profile: true,
            dob: true,
            whatsapp: true,
            friend_contacts: {
              where: {
                modelId,
              },
              select: {
                id: true,
              },
            },
          },
        },
        modelService: {
          select: {
            id: true,
            customRate: true,
            service: {
              select: {
                id: true,
                name: true,
                description: true,
                baseRate: true,
              },
            },
          },
        },
      },
    });

    return bookings.map((booking) => ({
      ...booking,
      isContact: !!booking.customer?.friend_contacts?.length,
    }));
  } catch (error: any) {
    console.error("GET_ALL_MODEL_BOOKINGS", error);
    throw new Error("Failed to query model bookings!");
  }
}

/**
 * Get booking detail for model
 */
export async function getModelBookingDetail(id: string, modelId: string) {
  try {
    return await prisma.service_booking.findFirst({
      where: {
        id,
        modelId,
      },
      select: {
        id: true,
        price: true,
        location: true,
        preferredAttire: true,
        startDate: true,
        endDate: true,
        status: true,
        dayAmount: true,
        createdAt: true,
        customer: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            profile: true,
            dob: true,
            whatsapp: true,
            gender: true,
          },
        },
        modelService: {
          select: {
            id: true,
            customRate: true,
            service: {
              select: {
                id: true,
                name: true,
                description: true,
                baseRate: true,
              },
            },
          },
        },
      },
    });
  } catch (error: any) {
    console.error("GET_MODEL_BOOKING_DETAIL", error);
    throw new Error("Failed to query booking detail!");
  }
}

/**
 * Accept booking (Model accepts a customer's booking request)
 */
export async function acceptBooking(id: string, modelId: string) {
  if (!id) throw new Error("Missing booking id!");
  if (!modelId) throw new Error("Missing model id!");

  const auditBase = {
    action: "ACCEPT_BOOKING",
    model: modelId,
  };

  try {
    const booking = await prisma.service_booking.findUnique({
      where: { id },
    });

    if (!booking) {
      throw new FieldValidationError({
        success: false,
        error: true,
        message: "The booking does not exist!",
      });
    }

    if (booking.modelId !== modelId) {
      throw new FieldValidationError({
        success: false,
        error: true,
        message: "Unauthorized to accept this booking!",
      });
    }

    if (booking.status !== "pending") {
      throw new FieldValidationError({
        success: false,
        error: true,
        message: "Only pending bookings can be accepted!",
      });
    }

    const updatedBooking = await prisma.service_booking.update({
      where: { id },
      data: { status: "confirmed" },
    });

    if (updatedBooking.id) {
      await createAuditLogs({
        ...auditBase,
        description: `Accept booking: ${updatedBooking.id} successfully.`,
        status: "success",
        onSuccess: updatedBooking,
      });

      // Send notification to customer (including SMS)
      try {
        const model = await prisma.model.findUnique({
          where: { id: modelId },
          select: { firstName: true },
        });
        const bookingWithService = await prisma.service_booking.findUnique({
          where: { id },
          include: { modelService: { include: { service: true } } },
        });
        if (model && bookingWithService && booking.customerId && bookingWithService.modelService?.service) {
          await notifyBookingConfirmed(
            booking.customerId,
            modelId,
            id,
            bookingWithService.modelService.service.name,
            model.firstName,
            booking.startDate,
            booking.location || undefined
          );
        }
      } catch (notifyError) {
        console.error("NOTIFY_BOOKING_CONFIRMED_FAILED", notifyError);
      }
    }

    return updatedBooking;
  } catch (error) {
    console.error("ACCEPT_BOOKING_FAILED", error);
    await createAuditLogs({
      ...auditBase,
      description: `Accept booking failed!`,
      status: "failed",
      onError: error,
    });
    throw error;
  }
}

/**
 * Reject booking (Model rejects a customer's booking request)
 * Automatically refunds the held payment to customer
 */
export async function rejectBooking(id: string, modelId: string, reason?: string) {
  if (!id) throw new Error("Missing booking id!");
  if (!modelId) throw new Error("Missing model id!");

  const auditBase = {
    action: "REJECT_BOOKING",
    model: modelId,
  };

  try {
    const booking = await prisma.service_booking.findUnique({
      where: { id },
    });

    if (!booking) {
      throw new FieldValidationError({
        success: false,
        error: true,
        message: "The booking does not exist!",
      });
    }

    if (booking.modelId !== modelId) {
      throw new FieldValidationError({
        success: false,
        error: true,
        message: "Unauthorized to reject this booking!",
      });
    }

    if (booking.status !== "pending") {
      throw new FieldValidationError({
        success: false,
        error: true,
        message: "Only pending bookings can be rejected!",
      });
    }

    // Refund payment to customer if held
    if (booking.paymentStatus === "held" && booking.holdTransactionId && booking.customerId) {
      await refundPaymentToCustomer(
        booking.customerId,
        booking.price,
        booking.id,
        booking.holdTransactionId,
        reason || "Booking rejected by model"
      );
    }

    const updatedBooking = await prisma.service_booking.update({
      where: { id },
      data: {
        status: "rejected",
        paymentStatus: "refunded",
        rejectReason: reason || null,
      },
    });

    if (updatedBooking.id) {
      await createAuditLogs({
        ...auditBase,
        description: `Reject booking: ${updatedBooking.id} with refund successfully. Reason: ${reason || "No reason provided"}`,
        status: "success",
        onSuccess: updatedBooking,
      });

      // Send notification to customer
      try {
        const model = await prisma.model.findUnique({
          where: { id: modelId },
          select: { firstName: true },
        });
        const bookingWithService = await prisma.service_booking.findUnique({
          where: { id },
          include: { modelService: { include: { service: true } } },
        });
        if (model && bookingWithService && booking.customerId && bookingWithService.modelService?.service) {
          await notifyBookingRejected(
            booking.customerId,
            modelId,
            id,
            bookingWithService.modelService.service.name,
            model.firstName,
            reason
          );
        }
      } catch (notifyError) {
        console.error("NOTIFY_BOOKING_REJECTED_FAILED", notifyError);
      }
    }

    return updatedBooking;
  } catch (error) {
    console.error("REJECT_BOOKING_FAILED", error);
    await createAuditLogs({
      ...auditBase,
      description: `Reject booking failed!`,
      status: "failed",
      onError: error,
    });

    if (error instanceof FieldValidationError) {
      throw error;
    }

    throw new FieldValidationError({
      success: false,
      error: true,
      message: "Failed to reject booking!",
    });
  }
}

/**
 * Delete booking (Model deletes a rejected booking)
 */
export async function deleteModelBooking(id: string, modelId: string) {
  if (!id) throw new Error("Missing booking id!");
  if (!modelId) throw new Error("Missing model id!");

  const auditBase = {
    action: "DELETE_MODEL_BOOKING",
    model: modelId,
  };

  try {
    const booking = await prisma.service_booking.findUnique({
      where: { id },
    });

    if (!booking) {
      throw new FieldValidationError({
        success: false,
        error: true,
        message: "The booking does not exist!",
      });
    }

    if (booking.modelId !== modelId) {
      throw new FieldValidationError({
        success: false,
        error: true,
        message: "Unauthorized to delete this booking!",
      });
    }

    const deletableStatuses = ["cancelled", "rejected", "completed"];
    if (!deletableStatuses.includes(booking.status)) {
      throw new FieldValidationError({
        success: false,
        error: true,
        message: "Only cancelled, rejected, or completed bookings can be deleted!",
      });
    }

    const deletedBooking = await prisma.service_booking.delete({
      where: { id },
    });

    if (deletedBooking.id) {
      await createAuditLogs({
        ...auditBase,
        description: `Delete booking: ${deletedBooking.id} successfully.`,
        status: "success",
        onSuccess: deletedBooking,
      });
    }

    return deletedBooking;
  } catch (error) {
    console.error("DELETE_MODEL_BOOKING_FAILED", error);
    await createAuditLogs({
      ...auditBase,
      description: `Delete booking failed!`,
      status: "failed",
      onError: error,
    });
    throw new FieldValidationError({
      success: false,
      error: true,
      message: "Failed to delete booking!",
    });
  }
}

/**
 * Complete booking (Model marks the date as completed after service is done)
 * Sets status to awaiting_confirmation - customer has 48h to confirm or dispute
 * Payment is NOT released yet - only after customer confirms or 48h passes
 */
export async function completeBooking(id: string, modelId: string) {
  if (!id) throw new Error("Missing booking id!");
  if (!modelId) throw new Error("Missing model id!");

  const auditBase = {
    action: "COMPLETE_BOOKING",
    model: modelId,
  };

  try {
    const booking = await prisma.service_booking.findUnique({
      where: { id },
    });

    if (!booking) {
      throw new FieldValidationError({
        success: false,
        error: true,
        message: "The booking does not exist!",
      });
    }

    if (booking.modelId !== modelId) {
      throw new FieldValidationError({
        success: false,
        error: true,
        message: "Unauthorized to complete this booking!",
      });
    }

    // Allow completion from in_progress OR confirmed status
    if (booking.status !== "in_progress" && booking.status !== "confirmed") {
      throw new FieldValidationError({
        success: false,
        error: true,
        message: "Only in-progress or confirmed bookings can be marked as completed!",
      });
    }

    // Check if booking date has passed (cannot complete before the date)
    const now = new Date();
    const bookingStart = new Date(booking.startDate);
    if (now < bookingStart) {
      throw new FieldValidationError({
        success: false,
        error: true,
        message: "Cannot complete booking before the scheduled date!",
      });
    }

    // Generate unique completion token for QR-based confirmation
    const completionToken = generateCompletionToken();

    // Set auto-release time to 24 hours from now
    const autoReleaseAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const tokenExpiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    // Update to awaiting_confirmation - DO NOT release payment yet
    const updatedBooking = await prisma.service_booking.update({
      where: { id },
      data: {
        status: "awaiting_confirmation",
        paymentStatus: "pending_release",
        modelCompletedAt: now,
        autoReleaseAt: autoReleaseAt,
        completionToken: completionToken,
        completionTokenExpiresAt: tokenExpiresAt,
      },
    });

    if (updatedBooking.id) {
      await createAuditLogs({
        ...auditBase,
        description: `Model marked booking ${updatedBooking.id} as complete. Awaiting customer confirmation (auto-release in 48h).`,
        status: "success",
        onSuccess: updatedBooking,
      });

      // Send notification to customer
      try {
        const model = await prisma.model.findUnique({
          where: { id: modelId },
          select: { firstName: true },
        });
        const bookingWithService = await prisma.service_booking.findUnique({
          where: { id },
          include: { modelService: { include: { service: true } } },
        });
        if (model && bookingWithService && booking.customerId && bookingWithService.modelService?.service) {
          await notifyBookingCompleted(
            booking.customerId,
            modelId,
            id,
            bookingWithService.modelService.service.name,
            model.firstName,
            booking.price
          );
        }
      } catch (notifyError) {
        console.error("NOTIFY_BOOKING_COMPLETED_FAILED", notifyError);
      }
    }

    return updatedBooking;
  } catch (error) {
    console.error("COMPLETE_BOOKING_FAILED", error);
    await createAuditLogs({
      ...auditBase,
      description: `Complete booking failed!`,
      status: "failed",
      onError: error,
    });

    if (error instanceof FieldValidationError) {
      throw error;
    }

    throw new FieldValidationError({
      success: false,
      error: true,
      message: "Failed to complete booking!",
    });
  }
}

// ========================================
// GPS Check-in Functions
// ========================================

/**
 * Model checks in at booking location
 */
export async function modelCheckIn(
  id: string,
  modelId: string,
  lat: number,
  lng: number
) {
  if (!id) throw new Error("Missing booking id!");
  if (!modelId) throw new Error("Missing model id!");

  const auditBase = {
    action: "MODEL_CHECK_IN",
    model: modelId,
  };

  try {
    const booking = await prisma.service_booking.findUnique({
      where: { id },
    });

    if (!booking) {
      throw new FieldValidationError({
        success: false,
        error: true,
        message: "The booking does not exist!",
      });
    }

    if (booking.modelId !== modelId) {
      throw new FieldValidationError({
        success: false,
        error: true,
        message: "Unauthorized to check in for this booking!",
      });
    }

    if (booking.status !== "confirmed" && booking.status !== "in_progress") {
      throw new FieldValidationError({
        success: false,
        error: true,
        message: "Can only check in for confirmed bookings!",
      });
    }

    if (booking.modelCheckedInAt) {
      throw new FieldValidationError({
        success: false,
        error: true,
        message: "You have already checked in for this booking!",
      });
    }

    // Check time window
    const timeCheck = isWithinCheckInTimeWindow(booking.startDate, booking.endDate);
    if (!timeCheck.canCheckIn) {
      throw new FieldValidationError({
        success: false,
        error: true,
        message: timeCheck.message,
      });
    }

    // Check GPS location if booking has coordinates
    if (booking.locationLat && booking.locationLng) {
      const locationCheck = isWithinCheckInRadius(
        lat,
        lng,
        booking.locationLat,
        booking.locationLng
      );
      if (!locationCheck.isWithin) {
        throw new FieldValidationError({
          success: false,
          error: true,
          message: `You are ${locationCheck.distance}m away from the booking location. Please move closer (within 50m) to check in.`,
        });
      }
    }

    // Determine new status - if customer already checked in, set to in_progress
    const newStatus = booking.customerCheckedInAt ? "in_progress" : booking.status;

    const updatedBooking = await prisma.service_booking.update({
      where: { id },
      data: {
        modelCheckedInAt: new Date(),
        modelCheckInLat: lat,
        modelCheckInLng: lng,
        status: newStatus,
      },
    });

    await createAuditLogs({
      ...auditBase,
      description: `Model checked in for booking ${id} at coordinates (${lat}, ${lng})`,
      status: "success",
      onSuccess: updatedBooking,
    });

    // Send notification to customer (including SMS)
    try {
      const model = await prisma.model.findUnique({
        where: { id: modelId },
        select: { firstName: true },
      });
      if (model && booking.customerId) {
        await notifyModelCheckedIn(
          booking.customerId,
          modelId,
          id,
          model.firstName,
          booking.location || undefined
        );
      }
    } catch (notifyError) {
      console.error("NOTIFY_MODEL_CHECKED_IN_FAILED", notifyError);
    }

    return updatedBooking;
  } catch (error) {
    console.error("MODEL_CHECK_IN_FAILED", error);
    await createAuditLogs({
      ...auditBase,
      description: `Model check-in failed!`,
      status: "failed",
      onError: error,
    });

    if (error instanceof FieldValidationError) {
      throw error;
    }

    throw new FieldValidationError({
      success: false,
      error: true,
      message: "Failed to check in!",
    });
  }
}

/**
 * Customer checks in at booking location
 */
export async function customerCheckIn(
  id: string,
  customerId: string,
  lat: number,
  lng: number
) {
  if (!id) throw new Error("Missing booking id!");
  if (!customerId) throw new Error("Missing customer id!");

  const auditBase = {
    action: "CUSTOMER_CHECK_IN",
    customer: customerId,
  };

  try {
    const booking = await prisma.service_booking.findUnique({
      where: { id },
    });

    if (!booking) {
      throw new FieldValidationError({
        success: false,
        error: true,
        message: "The booking does not exist!",
      });
    }

    if (booking.customerId !== customerId) {
      throw new FieldValidationError({
        success: false,
        error: true,
        message: "Unauthorized to check in for this booking!",
      });
    }

    if (booking.status !== "confirmed" && booking.status !== "in_progress") {
      throw new FieldValidationError({
        success: false,
        error: true,
        message: "Can only check in for confirmed bookings!",
      });
    }

    if (booking.customerCheckedInAt) {
      throw new FieldValidationError({
        success: false,
        error: true,
        message: "You have already checked in for this booking!",
      });
    }

    // Check time window
    const timeCheck = isWithinCheckInTimeWindow(booking.startDate, booking.endDate);
    if (!timeCheck.canCheckIn) {
      throw new FieldValidationError({
        success: false,
        error: true,
        message: timeCheck.message,
      });
    }

    // Check GPS location if booking has coordinates
    if (booking.locationLat && booking.locationLng) {
      const locationCheck = isWithinCheckInRadius(
        lat,
        lng,
        booking.locationLat,
        booking.locationLng
      );
      if (!locationCheck.isWithin) {
        throw new FieldValidationError({
          success: false,
          error: true,
          message: `You are ${locationCheck.distance}m away from the booking location. Please move closer (within 50m) to check in.`,
        });
      }
    }

    // Determine new status - if model already checked in, set to in_progress
    const newStatus = booking.modelCheckedInAt ? "in_progress" : booking.status;

    const updatedBooking = await prisma.service_booking.update({
      where: { id },
      data: {
        customerCheckedInAt: new Date(),
        customerCheckInLat: lat,
        customerCheckInLng: lng,
        status: newStatus,
      },
    });

    await createAuditLogs({
      ...auditBase,
      description: `Customer checked in for booking ${id} at coordinates (${lat}, ${lng})`,
      status: "success",
      onSuccess: updatedBooking,
    });

    // Send notification to model (including SMS)
    try {
      const customer = await prisma.customer.findUnique({
        where: { id: customerId },
        select: { firstName: true },
      });
      if (customer && booking.modelId) {
        await notifyCustomerCheckedIn(
          booking.modelId,
          customerId,
          id,
          customer.firstName,
          booking.location || undefined
        );
      }
    } catch (notifyError) {
      console.error("NOTIFY_CUSTOMER_CHECKED_IN_FAILED", notifyError);
    }

    return updatedBooking;
  } catch (error) {
    console.error("CUSTOMER_CHECK_IN_FAILED", error);
    await createAuditLogs({
      ...auditBase,
      description: `Customer check-in failed!`,
      status: "failed",
      onError: error,
    });

    if (error instanceof FieldValidationError) {
      throw error;
    }

    throw new FieldValidationError({
      success: false,
      error: true,
      message: "Failed to check in!",
    });
  }
}

// ========================================
// Customer Confirmation & Dispute Functions
// ========================================

/**
 * Customer confirms booking completion - releases payment to model
 */
export async function customerConfirmCompletion(id: string, customerId: string) {
  if (!id) throw new Error("Missing booking id!");
  if (!customerId) throw new Error("Missing customer id!");

  const auditBase = {
    action: "CUSTOMER_CONFIRM_COMPLETION",
    customer: customerId,
  };

  try {
    const booking = await prisma.service_booking.findUnique({
      where: { id },
      include: {
        modelService: { include: { service: true } },
      },
    });

    if (!booking) {
      throw new FieldValidationError({
        success: false,
        error: true,
        message: "The booking does not exist!",
      });
    }

    if (booking.customerId !== customerId) {
      throw new FieldValidationError({
        success: false,
        error: true,
        message: "Unauthorized to confirm this booking!",
      });
    }

    if (booking.status !== "awaiting_confirmation") {
      throw new FieldValidationError({
        success: false,
        error: true,
        message: "This booking is not awaiting confirmation!",
      });
    }

    // Release payment to model (with commission deduction)
    let releaseTransaction = null;
    if (booking.paymentStatus === "pending_release" && booking.holdTransactionId && booking.modelId) {
      const commissionRate = booking.modelService?.service?.commission || 0;
      releaseTransaction = await releasePaymentToModel(
        booking.modelId,
        booking.price,
        booking.id,
        booking.holdTransactionId,
        commissionRate
      );
    }

    const completedBooking = await prisma.service_booking.update({
      where: { id },
      data: {
        status: "completed",
        paymentStatus: "released",
        completedAt: new Date(),
        releaseTransactionId: releaseTransaction?.id || null,
      },
    });

    await createAuditLogs({
      ...auditBase,
      description: `Customer confirmed booking ${id} completion. Payment released to model.`,
      status: "success",
      onSuccess: completedBooking,
    });

    // Send notification to model
    try {
      const customer = await prisma.customer.findUnique({
        where: { id: customerId },
        select: { firstName: true },
      });
      const bookingWithService = await prisma.service_booking.findUnique({
        where: { id },
        include: { modelService: { include: { service: true } } },
      });
      if (customer && bookingWithService && booking.modelId && bookingWithService.modelService?.service) {
        await notifyCompletionConfirmed(
          booking.modelId,
          customerId,
          id,
          bookingWithService.modelService.service.name,
          customer.firstName,
          booking.price
        );
      }
    } catch (notifyError) {
      console.error("NOTIFY_COMPLETION_CONFIRMED_FAILED", notifyError);
    }

    return completedBooking;
  } catch (error) {
    console.error("CUSTOMER_CONFIRM_COMPLETION_FAILED", error);
    await createAuditLogs({
      ...auditBase,
      description: `Customer confirm completion failed!`,
      status: "failed",
      onError: error,
    });

    if (error instanceof FieldValidationError) {
      throw error;
    }

    throw new FieldValidationError({
      success: false,
      error: true,
      message: "Failed to confirm booking completion!",
    });
  }
}

/**
 * Confirm booking completion via QR token scan
 * Customer scans QR code shown by model to confirm service completion
 */
export async function confirmBookingByToken(token: string, customerId: string) {
  if (!token) throw new Error("Missing completion token!");
  if (!customerId) throw new Error("Missing customer id!");

  const auditBase = {
    action: "CONFIRM_BOOKING_BY_TOKEN",
    customer: customerId,
  };

  try {
    // Find booking by completion token
    const booking = await prisma.service_booking.findFirst({
      where: { completionToken: token },
      include: {
        model: { select: { firstName: true } },
        modelService: { include: { service: true } },
      },
    });

    if (!booking) {
      throw new FieldValidationError({
        success: false,
        error: true,
        message: "Invalid or expired QR code. Please ask the model to generate a new one.",
      });
    }

    // Verify customer ownership
    if (booking.customerId !== customerId) {
      throw new FieldValidationError({
        success: false,
        error: true,
        message: "This booking does not belong to you!",
      });
    }

    // Check if already completed
    if (booking.status === "completed") {
      throw new FieldValidationError({
        success: false,
        error: true,
        message: "This booking has already been completed!",
      });
    }

    // Check if booking is awaiting confirmation
    if (booking.status !== "awaiting_confirmation") {
      throw new FieldValidationError({
        success: false,
        error: true,
        message: "This booking is not awaiting confirmation!",
      });
    }

    // Check if token is expired
    const now = new Date();
    if (booking.completionTokenExpiresAt && booking.completionTokenExpiresAt < now) {
      throw new FieldValidationError({
        success: false,
        error: true,
        message: "This QR code has expired. The booking will be auto-completed within 24 hours.",
      });
    }

    // Release payment to model (with commission deduction)
    let releaseTransaction = null;
    if (booking.paymentStatus === "pending_release" && booking.holdTransactionId && booking.modelId) {
      const commissionRate = booking.modelService?.service?.commission || 0;
      releaseTransaction = await releasePaymentToModel(
        booking.modelId,
        booking.price,
        booking.id,
        booking.holdTransactionId,
        commissionRate
      );
    }

    // Complete the booking and clear the token
    const completedBooking = await prisma.service_booking.update({
      where: { id: booking.id },
      data: {
        status: "completed",
        paymentStatus: "released",
        completedAt: now,
        releaseTransactionId: releaseTransaction?.id || null,
        completionToken: null, // Clear token after use
        completionTokenExpiresAt: null,
      },
    });

    await createAuditLogs({
      ...auditBase,
      description: `Customer confirmed booking ${booking.id} via QR scan. Payment released to model.`,
      status: "success",
      onSuccess: completedBooking,
    });

    // Send notification to model
    try {
      const customer = await prisma.customer.findUnique({
        where: { id: customerId },
        select: { firstName: true },
      });
      if (customer && booking.modelId && booking.modelService?.service) {
        await notifyCompletionConfirmed(
          booking.modelId,
          customerId,
          booking.id,
          booking.modelService.service.name,
          customer.firstName,
          booking.price
        );
      }
    } catch (notifyError) {
      console.error("NOTIFY_COMPLETION_CONFIRMED_FAILED", notifyError);
    }

    return {
      ...completedBooking,
      modelName: booking.model?.firstName,
      serviceName: booking.modelService?.service?.name,
    };
  } catch (error) {
    console.error("CONFIRM_BOOKING_BY_TOKEN_FAILED", error);
    await createAuditLogs({
      ...auditBase,
      description: `Confirm booking by token failed!`,
      status: "failed",
      onError: error,
    });

    if (error instanceof FieldValidationError) {
      throw error;
    }

    throw new FieldValidationError({
      success: false,
      error: true,
      message: "Failed to confirm booking!",
    });
  }
}

/**
 * Get booking details by completion token (for QR scan preview)
 */
export async function getBookingByToken(token: string) {
  if (!token) return null;

  try {
    const booking = await prisma.service_booking.findFirst({
      where: { completionToken: token },
      select: {
        id: true,
        price: true,
        status: true,
        completionTokenExpiresAt: true,
        model: {
          select: {
            firstName: true,
            lastName: true,
            profile: true,
          },
        },
        customer: {
          select: {
            id: true,
            firstName: true,
          },
        },
        modelService: {
          select: {
            service: {
              select: {
                name: true,
              },
            },
          },
        },
      },
    });

    if (!booking) return null;

    // Check if expired
    const now = new Date();
    const isExpired = booking.completionTokenExpiresAt
      ? booking.completionTokenExpiresAt < now
      : false;

    return {
      ...booking,
      isExpired,
      isAlreadyCompleted: booking.status === "completed",
    };
  } catch (error) {
    console.error("GET_BOOKING_BY_TOKEN_FAILED", error);
    return null;
  }
}

/**
 * Get booking with completion token for model (to display QR)
 */
export async function getBookingWithToken(id: string, modelId: string) {
  try {
    return await prisma.service_booking.findFirst({
      where: {
        id,
        modelId,
      },
      select: {
        id: true,
        price: true,
        status: true,
        completionToken: true,
        completionTokenExpiresAt: true,
        autoReleaseAt: true,
        modelService: {
          select: {
            service: {
              select: {
                name: true,
              },
            },
          },
        },
        customer: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
      },
    });
  } catch (error) {
    console.error("GET_BOOKING_WITH_TOKEN_FAILED", error);
    throw new Error("Failed to get booking details!");
  }
}

/**
 * Customer disputes booking - goes to admin review
 */
export async function customerDisputeBooking(
  id: string,
  customerId: string,
  reason: string
) {
  if (!id) throw new Error("Missing booking id!");
  if (!customerId) throw new Error("Missing customer id!");
  if (!reason || reason.trim().length < 10) {
    throw new FieldValidationError({
      success: false,
      error: true,
      message: "Please provide a detailed reason for the dispute (at least 10 characters).",
    });
  }

  const auditBase = {
    action: "CUSTOMER_DISPUTE_BOOKING",
    customer: customerId,
  };

  try {
    const booking = await prisma.service_booking.findUnique({
      where: { id },
    });

    if (!booking) {
      throw new FieldValidationError({
        success: false,
        error: true,
        message: "The booking does not exist!",
      });
    }

    if (booking.customerId !== customerId) {
      throw new FieldValidationError({
        success: false,
        error: true,
        message: "Unauthorized to dispute this booking!",
      });
    }

    if (booking.status !== "awaiting_confirmation") {
      throw new FieldValidationError({
        success: false,
        error: true,
        message: "This booking cannot be disputed at this time!",
      });
    }

    const disputedBooking = await prisma.service_booking.update({
      where: { id },
      data: {
        status: "disputed",
        disputeReason: reason,
        disputedAt: new Date(),
      },
    });

    await createAuditLogs({
      ...auditBase,
      description: `Customer disputed booking ${id}. Reason: ${reason}`,
      status: "success",
      onSuccess: disputedBooking,
    });

    // Send notification to model
    try {
      const customer = await prisma.customer.findUnique({
        where: { id: customerId },
        select: { firstName: true },
      });
      const bookingWithService = await prisma.service_booking.findUnique({
        where: { id },
        include: { modelService: { include: { service: true } } },
      });
      if (customer && bookingWithService && booking.modelId && bookingWithService.modelService?.service) {
        await notifyBookingDisputed(
          booking.modelId,
          customerId,
          id,
          bookingWithService.modelService.service.name,
          customer.firstName,
          reason
        );
      }
    } catch (notifyError) {
      console.error("NOTIFY_BOOKING_DISPUTED_FAILED", notifyError);
    }

    return disputedBooking;
  } catch (error) {
    console.error("CUSTOMER_DISPUTE_BOOKING_FAILED", error);
    await createAuditLogs({
      ...auditBase,
      description: `Customer dispute booking failed!`,
      status: "failed",
      onError: error,
    });

    if (error instanceof FieldValidationError) {
      throw error;
    }

    throw new FieldValidationError({
      success: false,
      error: true,
      message: "Failed to dispute booking!",
    });
  }
}

// ========================================
// Auto-Release Function
// ========================================

/**
 * Process auto-release for bookings past 24h confirmation window
 * Call this on page load or via scheduled job
 */
export async function processAutoRelease() {
  const now = new Date();

  try {
    // Find all bookings awaiting confirmation past their auto-release time
    const bookingsToRelease = await prisma.service_booking.findMany({
      where: {
        status: "awaiting_confirmation",
        paymentStatus: "pending_release",
        autoReleaseAt: {
          lte: now,
        },
      },
      include: {
        modelService: { include: { service: true } },
      },
    });

    const results = [];

    for (const booking of bookingsToRelease) {
      try {
        // Release payment to model (with commission deduction)
        let releaseTransaction = null;
        if (booking.holdTransactionId && booking.modelId) {
          const commissionRate = booking.modelService?.service?.commission || 0;
          releaseTransaction = await releasePaymentToModel(
            booking.modelId,
            booking.price,
            booking.id,
            booking.holdTransactionId,
            commissionRate
          );
        }

        const completedBooking = await prisma.service_booking.update({
          where: { id: booking.id },
          data: {
            status: "completed",
            paymentStatus: "released",
            completedAt: now,
            releaseTransactionId: releaseTransaction?.id || null,
          },
        });

        await createAuditLogs({
          action: "AUTO_RELEASE_PAYMENT",
          description: `Auto-released payment for booking ${booking.id} after 48h confirmation window.`,
          status: "success",
          onSuccess: completedBooking,
        });

        // Send notifications to both model and customer
        try {
          if (booking.modelId && booking.customerId) {
            await notifyAutoReleasePayment(
              booking.modelId,
              booking.customerId,
              booking.id,
              booking.price
            );
          }
        } catch (notifyError) {
          console.error("NOTIFY_AUTO_RELEASE_FAILED", notifyError);
        }

        results.push({ bookingId: booking.id, status: "released" });
      } catch (error) {
        console.error(`Failed to auto-release booking ${booking.id}:`, error);
        results.push({ bookingId: booking.id, status: "failed", error });
      }
    }

    return results;
  } catch (error) {
    console.error("PROCESS_AUTO_RELEASE_FAILED", error);
    throw error;
  }
}

/**
 * Get pending booking count for a model
 */
export async function getModelPendingBookingCount(modelId: string): Promise<number> {
  try {
    return await prisma.service_booking.count({
      where: {
        modelId,
        status: "pending",
      },
    });
  } catch (error) {
    console.error("GET_MODEL_PENDING_BOOKING_COUNT_FAILED", error);
    return 0;
  }
}

/**
 * Get booking check-in status for display
 */
export function getBookingCheckInStatus(booking: {
  status: string;
  modelCheckedInAt?: Date | null;
  customerCheckedInAt?: Date | null;
  autoReleaseAt?: Date | null;
}) {
  const now = new Date();

  let checkInStatus = {
    modelCheckedIn: !!booking.modelCheckedInAt,
    customerCheckedIn: !!booking.customerCheckedInAt,
    bothCheckedIn: !!booking.modelCheckedInAt && !!booking.customerCheckedInAt,
    hoursUntilAutoRelease: 0,
  };

  if (booking.autoReleaseAt) {
    const autoRelease = new Date(booking.autoReleaseAt);
    checkInStatus.hoursUntilAutoRelease = Math.max(
      0,
      Math.ceil((autoRelease.getTime() - now.getTime()) / (1000 * 60 * 60))
    );
  }

  return checkInStatus;
}
