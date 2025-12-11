import { z } from "zod";
import { prisma } from "./database.server";
import { FieldValidationError } from "./base.server";

// ====================== Review input interface
export interface IReviewCredentials {
  rating: number;
  title?: string;
  reviewText?: string;
  isAnonymous?: boolean;
  modelId: string;
  customerId: string;
}

// ====================== Review response interface
export interface IReviewResponse {
  id: string;
  rating: number;
  title: string | null;
  reviewText: string | null;
  isAnonymous: boolean;
  createdAt: Date;
  customer: {
    id: string;
    firstName: string;
    lastName: string | null;
    profile: string | null;
  } | null;
}

// ====================== Basic SQLi blocker
const blockInjection = (value: string) => {
  return !/('|--|\/\/|\/\*|\*\/|;|\b(select|insert|update|delete|drop|alter|create|exec|execute|union|grant|revoke|truncate|xp_cmdshell|call|declare)\b|\b(or|and)\b\s+\d+=\d+|\bOR\b\s+['"]?\d+['"]?\s*=\s*['"]?|<script.*?>.*?<\/script>|javascript:|on\w+=["'].*?["'])/gis.test(
    value
  );
};

const refineSafe = (schema: z.ZodString) =>
  schema
    .refine((val) => val.trim().length > 0, {
      message: "Field cannot be empty.",
    })
    .refine(blockInjection, { message: "Potentially unsafe input detected." });

// ====================== Review validation schema
const reviewSchema = z.object({
  rating: z
    .number()
    .min(1, "Rating must be at least 1 star.")
    .max(5, "Rating cannot exceed 5 stars."),
  title: z
    .string()
    .max(100, "Title must be at most 100 characters.")
    .optional()
    .nullable(),
  reviewText: z
    .string()
    .max(500, "Review text must be at most 500 characters.")
    .optional()
    .nullable(),
  isAnonymous: z.boolean().optional().default(false),
  modelId: refineSafe(z.string()),
  customerId: refineSafe(z.string()),
});

// ====================== Validate review inputs
export function validateReviewInputs(input: IReviewCredentials) {
  const result = reviewSchema.safeParse(input);

  if (!result.success) {
    const errors: Partial<Record<string, string>> = {};
    for (const issue of result.error.issues) {
      const key = issue.path[0] as string;
      errors[key] = issue.message;
    }
    throw errors;
  }
  return result.data;
}

// ====================== Create a new review
export async function createReview(input: IReviewCredentials) {
  try {
    // Validate input
    const validatedData = validateReviewInputs(input);

    // Check if customer has already reviewed this model
    const existingReview = await prisma.review.findFirst({
      where: {
        modelId: validatedData.modelId,
        customerId: validatedData.customerId,
      },
    });

    if (existingReview) {
      throw new FieldValidationError({
        success: false,
        error: true,
        message: "You have already reviewed this model.",
      });
    }

    // Check if customer has at least one completed booking with this model
    const completedBooking = await prisma.service_booking.findFirst({
      where: {
        modelId: validatedData.modelId,
        customerId: validatedData.customerId,
        status: "completed",
      },
    });

    if (!completedBooking) {
      throw new FieldValidationError({
        success: false,
        error: true,
        message: "You can only review models you have completed a booking with.",
      });
    }

    // Create the review
    const review = await prisma.review.create({
      data: {
        rating: validatedData.rating,
        title: validatedData.title || null,
        reviewText: validatedData.reviewText || null,
        isAnonymous: validatedData.isAnonymous || false,
        modelId: validatedData.modelId,
        customerId: validatedData.customerId,
        // Use a placeholder sessionId - in a real scenario, this should be linked to the actual session
        sessionId: completedBooking.id,
      },
    });

    // Update model's average rating and total reviews
    await updateModelRating(validatedData.modelId);

    return {
      success: true,
      error: false,
      message: "Review submitted successfully!",
      review,
    };
  } catch (error: any) {
    console.error("CREATE_REVIEW_ERROR:", error);
    if (error instanceof FieldValidationError) {
      throw error;
    }
    throw new FieldValidationError({
      success: false,
      error: true,
      message: error.message || "Failed to submit review. Please try again.",
    });
  }
}

// ====================== Get reviews for a model
export async function getModelReviews(
  modelId: string,
  page: number = 1,
  limit: number = 10
) {
  try {
    const skip = (page - 1) * limit;

    const [reviews, totalCount] = await Promise.all([
      prisma.review.findMany({
        where: {
          modelId,
        },
        orderBy: {
          createdAt: "desc",
        },
        skip,
        take: limit,
        include: {
          customer: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              profile: true,
            },
          },
        },
      }),
      prisma.review.count({
        where: {
          modelId,
        },
      }),
    ]);

    // Map reviews to hide customer info if anonymous
    const mappedReviews: IReviewResponse[] = reviews.map((review) => ({
      id: review.id,
      rating: review.rating,
      title: review.title,
      reviewText: review.reviewText,
      isAnonymous: review.isAnonymous || false,
      createdAt: review.createdAt,
      customer: review.isAnonymous
        ? null
        : review.customer
          ? {
              id: review.customer.id,
              firstName: review.customer.firstName,
              lastName: review.customer.lastName,
              profile: review.customer.profile,
            }
          : null,
    }));

    return {
      reviews: mappedReviews,
      totalCount,
      totalPages: Math.ceil(totalCount / limit),
      currentPage: page,
    };
  } catch (error: any) {
    console.error("GET_MODEL_REVIEWS_ERROR:", error);
    throw new FieldValidationError({
      success: false,
      error: true,
      message: error.message || "Failed to fetch reviews.",
    });
  }
}

// ====================== Update model's average rating
async function updateModelRating(modelId: string) {
  try {
    const aggregation = await prisma.review.aggregate({
      where: {
        modelId,
      },
      _avg: {
        rating: true,
      },
      _count: {
        rating: true,
      },
    });

    const averageRating = aggregation._avg.rating || 0;
    const totalReviews = aggregation._count.rating || 0;

    await prisma.model.update({
      where: {
        id: modelId,
      },
      data: {
        rating: Math.round(averageRating * 10) / 10, // Round to 1 decimal
        total_review: totalReviews,
      },
    });
  } catch (error) {
    console.error("UPDATE_MODEL_RATING_ERROR:", error);
    // Don't throw - this is a background operation
  }
}

// ====================== Check if customer can review a model
export async function canCustomerReviewModel(
  customerId: string,
  modelId: string
): Promise<{ canReview: boolean; reason?: string }> {
  try {
    // Check if already reviewed
    const existingReview = await prisma.review.findFirst({
      where: {
        modelId,
        customerId,
      },
    });

    if (existingReview) {
      return {
        canReview: false,
        reason: "already_reviewed",
      };
    }

    // Check if has completed booking
    const completedBooking = await prisma.service_booking.findFirst({
      where: {
        modelId,
        customerId,
        status: "completed",
      },
    });

    if (!completedBooking) {
      return {
        canReview: false,
        reason: "no_completed_booking",
      };
    }

    return {
      canReview: true,
    };
  } catch (error) {
    console.error("CAN_CUSTOMER_REVIEW_ERROR:", error);
    return {
      canReview: false,
      reason: "error",
    };
  }
}

// ====================== Get customer's review for a model
export async function getCustomerReviewForModel(
  customerId: string,
  modelId: string
) {
  try {
    const review = await prisma.review.findFirst({
      where: {
        modelId,
        customerId,
      },
    });

    return review;
  } catch (error) {
    console.error("GET_CUSTOMER_REVIEW_ERROR:", error);
    return null;
  }
}
