import { prisma } from "./database.server";
import { default as bcrypt } from "bcryptjs";
import { differenceInYears } from "date-fns";
import { createAuditLogs } from "./log.server";
import { FieldValidationError } from "./base.server";
import { notifyCustomerLikeReceived } from "./notification.server";

const { compare, hash } = bcrypt;

interface ForYouFilters {
  gender?: string;
  location?: string;
  minRating?: number;
  relationshipStatus?: string;
  ageRange?: [number, number];
  maxDistance?: number;
  customerLat?: number;
  customerLng?: number;
  page?: number;
  perPage?: number;
}

// Discover page - Get online/active models that customer hasn't passed
export async function getModelsForCustomer(customerId: string) {
  try {
    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
      select: { latitude: true, longitude: true },
    });

    const models = await prisma.model.findMany({
      where: {
        status: "active",
        customer_interactions: {
          none: {
            customerId,
            action: "PASS",
          },
        },
      },
      take: 20,
      orderBy: [
        // Prioritize models with higher ratings
        { rating: "desc" },
        // Then by most recent activity
        { updatedAt: "desc" },
      ],
      select: {
        id: true,
        firstName: true,
        lastName: true,
        dob: true,
        gender: true,
        bio: true,
        whatsapp: true,
        address: true,
        profile: true,
        rating: true,
        total_review: true,
        latitude: true,
        longitude: true,
        available_status: true,
        createdAt: true,
        updatedAt: true,
        Images: {
          where: { status: "active" },
          take: 5,
          select: { id: true, name: true },
          orderBy: { createdAt: "desc" },
        },
        customer_interactions: {
          where: { customerId },
          select: { action: true, createdAt: true },
        },
        friend_contacts: {
          where: {
            adderType: "CUSTOMER",
            customerId: customerId,
            contactType: "MODEL",
          },
          select: {
            id: true,
            modelId: true,
            contactType: true,
          },
        },
        // Count total likes received
        _count: {
          select: {
            customer_interactions: {
              where: { action: "LIKE" },
            },
            model_interactions: {
              where: { action: "LIKE" },
            },
          },
        },
      },
    });

    // Calculate distance and enhance models
    return models.map((model) => {
      let distance = null;
      if (
        customer?.latitude &&
        customer?.longitude &&
        model.latitude &&
        model.longitude
      ) {
        distance = calculateDistance(
          customer.latitude,
          customer.longitude,
          model.latitude,
          model.longitude
        );
      }

      return {
        ...model,
        distance: distance ? Number(distance.toFixed(2)) : null,
        customerAction:
          model.customer_interactions.length > 0
            ? model.customer_interactions[0].action
            : null,
        isContact: model.friend_contacts.length > 0,
        totalLikes: model._count.customer_interactions,
        popularity:
          model._count.customer_interactions + model._count.model_interactions,
      };
    });
  } catch (error: any) {
    console.error("GET_MODELS_FOR_CUSTOMER_ERROR:", error);
    throw new FieldValidationError({
      success: false,
      error: true,
      message: error.message || "Failed to fetch models!",
    });
  }
}

function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
) {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const R = 6371; // Earth's radius in km
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Get nearby models based on geolocation distance
export async function getNearbyModels(
  customerId: string,
  maxDistanceKm: number = 50
) {
  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
    select: {
      latitude: true,
      longitude: true,
      gender: true, // Use for opposite gender matching
    },
  });

  if (!customer?.latitude || !customer?.longitude)
    throw new Error("Customer location missing");

  const models = await prisma.model.findMany({
    where: {
      latitude: { not: null },
      longitude: { not: null },
      status: "active",
      // Exclude models the customer has passed
      customer_interactions: {
        none: {
          customerId,
          action: "PASS",
        },
      },
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      dob: true,
      gender: true,
      bio: true,
      whatsapp: true,
      profile: true,
      latitude: true,
      longitude: true,
      address: true,
      status: true,
      rating: true,
      total_review: true,
      available_status: true,
      updatedAt: true,
      Images: {
        take: 3,
        where: { status: "active" },
        select: { id: true, name: true },
        orderBy: { createdAt: "desc" },
      },
      customer_interactions: {
        where: { customerId },
        select: { action: true },
      },
      friend_contacts: {
        where: {
          adderType: "CUSTOMER",
          customerId: customerId,
          contactType: "MODEL",
        },
        select: {
          id: true,
          modelId: true,
          contactType: true,
        },
      },
      _count: {
        select: {
          customer_interactions: {
            where: { action: "LIKE" },
          },
        },
      },
    },
  });

  // Calculate distance and filter by maxDistance
  const modelsWithDistance = models
    .map((m) => {
      const distance = calculateDistance(
        customer.latitude!,
        customer.longitude!,
        m.latitude!,
        m.longitude!
      );

      return {
        ...m,
        distance: Number(distance.toFixed(2)),
        isContact: m.friend_contacts.length > 0,
        customerAction:
          m.customer_interactions.length > 0
            ? m.customer_interactions[0].action
            : null,
        totalLikes: m._count.customer_interactions,
      };
    })
    .filter((m) => m.distance <= maxDistanceKm) // Filter by max distance
    .sort((a, b) => {
      // Sort by distance first, then by rating
      if (a.distance !== b.distance) {
        return a.distance - b.distance;
      }
      return b.rating - a.rating;
    })
    .slice(0, 20); // Return top 20 nearest

  return modelsWithDistance;
}

// Get hot/trending models based on popularity and recent activity
export async function getHotModels(customerId: string, limit: number = 10) {
  try {
    // Get customer info for personalized results
    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
      select: { latitude: true, longitude: true, gender: true },
    });

    // Calculate "hot" models based on multiple factors:
    // 1. Total likes received (both from customers and models)
    // 2. High rating
    // 3. Recent activity (updatedAt)
    // 4. Number of reviews
    const currentDate = new Date();
    const thirtyDaysAgo = new Date(
      currentDate.getTime() - 30 * 24 * 60 * 60 * 1000
    );

    const hotModels = await prisma.model.findMany({
      where: {
        status: "active",
        // Exclude models the customer has passed
        customer_interactions: {
          none: {
            customerId,
            action: "PASS",
          },
        },
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        dob: true,
        gender: true,
        bio: true,
        whatsapp: true,
        profile: true,
        rating: true,
        total_review: true,
        latitude: true,
        longitude: true,
        address: true,
        available_status: true,
        updatedAt: true,
        createdAt: true,
        Images: {
          take: 3,
          where: {
            status: "active",
          },
          select: {
            id: true,
            name: true,
          },
          orderBy: { createdAt: "desc" },
        },
        customer_interactions: {
          where: { customerId },
          select: { action: true },
        },
        friend_contacts: {
          where: {
            adderType: "CUSTOMER",
            customerId: customerId,
            contactType: "MODEL",
          },
          select: {
            id: true,
            modelId: true,
            contactType: true,
          },
        },
        _count: {
          select: {
            // Count all likes from customers
            customer_interactions: {
              where: { action: "LIKE" },
            },
            // Count all likes from other models
            model_interactions: {
              where: { action: "LIKE" },
            },
            // Count recent interactions (last 30 days)
            service_booking: {
              where: {
                createdAt: { gte: thirtyDaysAgo },
                status: { in: ["confirmed", "completed"] },
              },
            },
          },
        },
      },
    });

    // Calculate popularity score for each model
    const modelsWithScore = hotModels.map((model) => {
      const customerLikes = model._count.customer_interactions;
      const modelLikes = model._count.model_interactions;
      const recentBookings = model._count.service_booking;
      const reviewScore = model.total_review * 0.5;
      const ratingScore = model.rating * 10;

      // Calculate days since last activity
      const daysSinceUpdate = Math.floor(
        (currentDate.getTime() - new Date(model.updatedAt).getTime()) /
          (1000 * 60 * 60 * 24)
      );
      const recencyScore = Math.max(0, 30 - daysSinceUpdate); // Higher score for recent activity

      // Calculate distance if location available
      let distance = null;
      let distanceScore = 0;
      if (
        customer?.latitude &&
        customer?.longitude &&
        model.latitude &&
        model.longitude
      ) {
        distance = calculateDistance(
          customer.latitude,
          customer.longitude,
          model.latitude,
          model.longitude
        );
        // Closer models get higher score (max 20 points for models within 10km)
        distanceScore = Math.max(0, 20 - distance / 5);
      }

      // Popularity formula (weighted scoring):
      // - Customer likes: 3 points each
      // - Model likes: 2 points each
      // - Recent bookings: 5 points each
      // - Rating: rating * 10 (max 50 points)
      // - Reviews: total_review * 0.5
      // - Recency: max 30 points
      // - Distance: max 20 points
      const popularityScore =
        customerLikes * 3 +
        modelLikes * 2 +
        recentBookings * 5 +
        ratingScore +
        reviewScore +
        recencyScore +
        distanceScore;

      return {
        ...model,
        distance: distance ? Number(distance.toFixed(2)) : null,
        customerAction:
          model.customer_interactions.length > 0
            ? model.customer_interactions[0].action
            : null,
        isContact: model.friend_contacts.length > 0,
        likeCount: customerLikes,
        totalLikes: customerLikes + modelLikes,
        recentBookings: recentBookings,
        popularityScore: Number(popularityScore.toFixed(2)),
      };
    });

    // Sort by popularity score and return top results
    const sortedModels = modelsWithScore
      .sort((a, b) => b.popularityScore - a.popularityScore)
      .slice(0, limit);

    return sortedModels;
  } catch (error: any) {
    console.log("GET_HOT_MODELS_ERROR:", error);
    throw new FieldValidationError({
      success: false,
      error: true,
      message: error.message || "Failed to fetch hot models!",
    });
  }
}

export async function getModelProfile(modelId: string, customerId: string) {
  try {
    const model = await prisma.model.findFirst({
      where: {
        id: modelId,
        status: "active",
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        dob: true,
        gender: true,
        latitude: true,
        longitude: true,
        address: true,
        available_status: true,
        profile: true,
        status: true,
        rating: true,
        total_review: true,
        createdAt: true,
        career: true,
        education: true,
        relationshipStatus: true,
        interests: true,
        bio: true,
        whatsapp: true,
        Images: {
          where: { status: "active" },
          select: { id: true, name: true },
        },
        friend_contacts: {
          where: {
            adderType: "CUSTOMER",
            customerId,
            contactType: "MODEL",
          },
          select: { id: true, modelId: true, contactType: true },
        },
        ModelService: {
          where: { status: "active" },
          select: {
            id: true,
            customRate: true,
            customHourlyRate: true,
            customOneTimePrice: true,
            customOneNightPrice: true,
            isAvailable: true,
            minSessionDuration: true,
            maxSessionDuration: true,
            service: {
              select: {
                id: true,
                name: true,
                description: true,
                baseRate: true,
                billingType: true,
                hourlyRate: true,
                oneTimePrice: true,
                oneNightPrice: true,
              },
            },
            model_service_variant: {
              where: { status: "active" },
              select: {
                id: true,
                name: true,
                pricePerHour: true,
              },
            },
          },
        },
        customer_interactions: {
          where: { customerId },
          select: { action: true },
        },
        // 👇 Add count fields directly using Prisma's relation count
        _count: {
          select: {
            friend_contacts: true,
            customer_interactions: true,
          },
        },
      },
    });

    if (!model) return null;

    // Derive extra fields
    return {
      ...model,
      isContact: model.friend_contacts.length > 0,
      customerAction:
        model.customer_interactions.length > 0
          ? model.customer_interactions[0].action
          : null,
      totalFriends: model._count.friend_contacts,
      totalLikes: model._count.customer_interactions,
    };
  } catch (error: any) {
    console.error("GET_MODEL_DATA_ERROR:", error);
    throw new FieldValidationError({
      success: false,
      error: true,
      message: error.message || "Failed to fetch model profile!",
    });
  }
}

// Get model service for book:
export async function getModelService(modelId: string, serviceId: string) {
  try {
    return await prisma.model_service.findFirst({
      where: {
        id: serviceId,
        modelId: modelId,
        status: "active",
      },
      select: {
        id: true,
        customRate: true,
        customHourlyRate: true,
        customOneTimePrice: true,
        customOneNightPrice: true,
        isAvailable: true,
        serviceLocation: true,
        model: {
          select: {
            address: true,
          },
        },
        service: {
          select: {
            id: true,
            name: true,
            description: true,
            baseRate: true,
            billingType: true,
            hourlyRate: true,
            oneTimePrice: true,
            oneNightPrice: true,
          },
        },
        model_service_variant: {
          where: {
            status: "active",
          },
          select: {
            id: true,
            name: true,
            pricePerHour: true,
          },
        },
      },
    });
  } catch (error: any) {
    console.error("GET_MODEL_SERVICE_ERROR:", error);
    throw new FieldValidationError({
      success: false,
      error: true,
      message: error.message || "Failed to fetch model service!",
    });
  }
}

export async function getModel(id: string) {
  try {
    return await prisma.model.findFirst({
      where: {
        id,
        status: "active",
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
      },
    });
  } catch (error: any) {
    console.log("GET_MODEL_DATA_ERROR:", error);
    throw new FieldValidationError({
      success: false,
      error: true,
      message: error.message || "Failed to fetch hot model!",
    });
  }
}

// Match page: ================
export async function getForyouModels(
  customerId: string,
  filters: ForYouFilters = {}
) {
  try {
    const page = filters.page ?? 1;
    const perPage = filters.perPage ?? 20;
    const skip = (page - 1) * perPage;

    // Get customer location for distance filtering
    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
      select: { latitude: true, longitude: true },
    });

    // Fetch ALL models (without pagination first, for distance filtering)
    const allModels = await prisma.model.findMany({
      where: {
        status: "active",
        ...(filters.gender ? { gender: filters.gender } : {}),
        ...(filters.location
          ? { address: { contains: filters.location } }
          : {}),
        ...(filters.minRating ? { rating: { gte: filters.minRating } } : {}),
        ...(filters.relationshipStatus
          ? { available_status: filters.relationshipStatus }
          : {}),
        NOT: {
          customer_interactions: {
            some: {
              customerId,
              action: "PASS",
            },
          },
        },
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        dob: true,
        profile: true,
        whatsapp: true,
        latitude: true,
        longitude: true,
        status: true,
        bio: true,
        available_status: true,
        rating: true,
        Images: {
          where: { status: "active" },
          select: { id: true, name: true },
        },
        customer_interactions: {
          where: {
            customerId,
            action: { not: "PASS" },
          },
          select: { action: true },
        },
        friend_contacts: {
          where: {
            adderType: "CUSTOMER",
            customerId: customerId,
            contactType: "MODEL",
          },
          select: {
            id: true,
            modelId: true,
            contactType: true,
          },
        },
      },
    });

    // Local filtering (age, distance)
    const filteredModels = allModels.filter((m) => {
      let pass = true;

      // Age filter
      if (filters.ageRange) {
        const age = differenceInYears(new Date(), new Date(m.dob));
        if (age < filters.ageRange[0] || age > filters.ageRange[1])
          pass = false;
      }

      // Distance filter - use customer's GPS coordinates from database
      if (
        filters.maxDistance &&
        customer?.latitude &&
        customer?.longitude &&
        m.latitude &&
        m.longitude
      ) {
        const distance = calculateDistance(
          customer.latitude,
          customer.longitude,
          m.latitude,
          m.longitude
        );

        if (distance > filters.maxDistance) pass = false;
      }

      return pass;
    });

    // Add derived fields (isContact, customerAction)
    const enhancedModels = filteredModels.map((model) => ({
      ...model,
      customerAction:
        model.customer_interactions.length > 0
          ? model.customer_interactions[0].action
          : null,
      isContact: model.friend_contacts.length > 0,
    }));

    // Apply pagination AFTER filtering
    const totalCount = enhancedModels.length;
    const paginatedModels = enhancedModels.slice(skip, skip + perPage);

    // Pagination info
    const totalPages = Math.ceil(totalCount / perPage);

    return {
      models: paginatedModels,
      pagination: {
        currentPage: page,
        totalPages,
        totalCount,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
        limit: perPage,
      },
    };
  } catch (error: any) {
    console.log("GET_FORYOU_MODEL_ERROR:", error);
    throw error;
  }
}

export async function getLikeMeModels(
  customerId: string,
  page: number = 1,
  limit: number = 20
) {
  try {
    const [models, totalCount] = await Promise.all([
      prisma.model.findMany({
        skip: (page - 1) * limit,
        take: limit,
        where: {
          status: "active",
          model_interactions: {
            some: {
              customerId: customerId.toString(),
              action: "LIKE",
            },
          },
        },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          dob: true,
          profile: true,
          whatsapp: true,
          latitude: true,
          longitude: true,
          status: true,
          bio: true,
          available_status: true,
          Images: {
            where: { status: "active" },
            select: { id: true, name: true },
          },
          model_interactions: {
            where: {
              customerId: customerId.toString(),
              action: "LIKE",
            },
            select: { action: true },
          },
          customer_interactions: {
            where: {
              customerId,
              action: "LIKE",
            },
            select: { action: true },
          },
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
      }),
      prisma.model.count({
        where: {
          status: "active",
          model_interactions: {
            some: {
              customerId: customerId.toString(),
              action: "LIKE",
            },
          },
        },
      }),
    ]);

    // Add derived field: isContact
    const enhancedModels = models.map((model) => ({
      ...model,
      isContact: model.friend_contacts.length > 0,
    }));

    const totalPages = Math.ceil(totalCount / limit);

    return {
      models: enhancedModels,
      pagination: {
        currentPage: page,
        totalPages,
        totalCount,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
        limit,
      },
    };
  } catch (error: any) {
    console.log("GET_LIKEME_MODEL_ERROR:", error);
    throw error;
  }
}

export async function getModelsByInteraction(
  customerId: string,
  action: "LIKE" | "PASS",
  page: number = 1,
  limit: number = 20
) {
  try {
    const [models, totalCount] = await Promise.all([
      prisma.model.findMany({
        skip: (page - 1) * limit,
        take: limit,
        where: {
          status: "active",
          customer_interactions: {
            some: {
              customerId,
              action,
            },
          },
        },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          dob: true,
          profile: true,
          whatsapp: true,
          latitude: true,
          longitude: true,
          status: true,
          bio: true,
          available_status: true,
          Images: {
            where: { status: "active" },
            select: { id: true, name: true },
          },
          customer_interactions: {
            where: {
              customerId,
              action,
            },
            select: { action: true },
          },
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
      }),
      prisma.model.count({
        where: {
          status: "active",
          customer_interactions: {
            some: {
              customerId: customerId.toString(),
              action,
            },
          },
        },
      }),
    ]);

    // Add derived field: isContact
    const enhancedModels = models.map((model) => ({
      ...model,
      isContact: model.friend_contacts.length > 0,
    }));

    const totalPages = Math.ceil(totalCount / limit);

    return {
      models: enhancedModels,
      pagination: {
        currentPage: page,
        totalPages,
        totalCount,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
        limit,
      },
    };
  } catch (error: any) {
    console.log("GET_MODELS_BY_INTERACTION_ERROR:", error);
    throw error;
  }
}

// ==================== MODEL-SIDE FUNCTIONS ====================
// These functions are for models to query their own data

export async function getModelDashboardData(modelId: string) {
  return await prisma.model.findUnique({
    where: { id: modelId },
    include: {
      Images: {
        where: { status: "active" },
        select: { id: true, name: true },
      },
      Wallet: {
        select: {
          totalBalance: true,
          totalRecharge: true,
          totalDeposit: true,
          status: true,
        },
      },
      Review: {
        include: {
          customer: {
            select: {
              firstName: true,
              lastName: true,
              profile: true,
            },
          },
        },
        orderBy: {
          createdAt: "desc",
        },
        take: 10,
      },
      ModelService: {
        where: { status: "active" },
        include: {
          service: true,
        },
      },
    },
  });
}

export async function getModelBookingRequests(
  modelId: string,
  status?: string
) {
  const where: any = {
    modelId: modelId,
  };

  if (status) {
    where.status = status;
  }

  return await prisma.service_booking.findMany({
    where,
    include: {
      customer: {
        select: {
          id: true,
          number: true,
          firstName: true,
          lastName: true,
          profile: true,
          gender: true,
          dob: true,
          bio: true,
        },
      },
      modelService: {
        include: {
          service: true,
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });
}

export async function getModelSessions(modelId: string, limit = 20) {
  return await prisma.session.findMany({
    where: {
      modelId: modelId,
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
          service: true,
        },
      },
    },
    orderBy: {
      sessionStart: "desc",
    },
    take: limit,
  });
}

export async function getModelEarnings(modelId: string) {
  const wallet = await prisma.wallet.findFirst({
    where: { modelId: modelId },
  });

  const transactions = await prisma.transaction_history.findMany({
    where: {
      modelId: modelId,
    },
    orderBy: {
      createdAt: "desc",
    },
    take: 50,
  });

  // Calculate total earnings from sessions
  const sessions = await prisma.session.findMany({
    where: {
      modelId: modelId,
      paymentStatus: "paid",
    },
    select: {
      totalCost: true,
    },
  });

  const totalEarnings = sessions.reduce(
    (sum, session) => sum + session.totalCost,
    0
  );

  // Calculate pending earnings
  const pendingSessions = await prisma.session.findMany({
    where: {
      modelId: modelId,
      paymentStatus: "pending",
    },
    select: {
      totalCost: true,
    },
  });

  const pendingEarnings = pendingSessions.reduce(
    (sum, session) => sum + session.totalCost,
    0
  );

  return {
    wallet,
    transactions,
    totalEarnings,
    pendingEarnings,
    balance: wallet?.totalBalance || 0,
  };
}

export async function getModelConversations(modelId: string) {
  return await prisma.conversation.findMany({
    where: {
      modelId: modelId,
      status: "active",
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
      messages: {
        orderBy: {
          sendAt: "desc",
        },
        take: 1,
      },
    },
    orderBy: {
      lastMessage: "desc",
    },
  });
}

export async function getCustomersWhoLikedModel(modelId: string) {
  return await prisma.customer_interactions.findMany({
    where: {
      modelId: modelId,
      action: "LIKE",
    },
    include: {
      customer: {
        select: {
          id: true,
          number: true,
          firstName: true,
          lastName: true,
          profile: true,
          gender: true,
          dob: true,
          bio: true,
          Images: {
            where: { status: "active" },
            select: { id: true, name: true },
            take: 3,
          },
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });
}

export async function updateModelAvailability(
  modelId: string,
  availableStatus: string
) {
  return await prisma.model.update({
    where: { id: modelId },
    data: {
      available_status: availableStatus,
    },
  });
}

export async function updateModelProfile(
  modelId: string,
  data: {
    bio?: string;
    hourly_rate_talking?: number;
    hourly_rate_video?: number;
    interests?: any;
    relationshipStatus?: string;
    career?: string;
    education?: string;
    defaultLanguage?: string;
    defaultTheme?: string;
    firstName?: string;
    lastName?: string;
    profile?: string;
  }
) {
  return await prisma.model.update({
    where: { id: modelId },
    data,
  });
}

export async function updateBookingStatus(
  bookingId: string,
  status: string,
  modelId?: string
) {
  // Verify the booking belongs to the model if modelId is provided
  if (modelId) {
    const booking = await prisma.service_booking.findFirst({
      where: {
        id: bookingId,
        modelId: modelId,
      },
    });

    if (!booking) {
      throw new Error("Booking not found or does not belong to this model");
    }
  }

  return await prisma.service_booking.update({
    where: { id: bookingId },
    data: { status },
  });
}

export async function getModelDashboardStats(modelId: string) {
  // Total bookings
  const totalBookings = await prisma.service_booking.count({
    where: { modelId: modelId },
  });

  // Pending bookings
  const pendingBookings = await prisma.service_booking.count({
    where: {
      modelId: modelId,
      status: "pending",
    },
  });

  // Total sessions
  const totalSessions = await prisma.session.count({
    where: { modelId: modelId },
  });

  // Total likes
  const totalLikes = await prisma.customer_interactions.count({
    where: {
      modelId: modelId,
      action: "LIKE",
    },
  });

  // Average rating
  const model = await prisma.model.findUnique({
    where: { id: modelId },
    select: {
      rating: true,
      total_review: true,
    },
  });

  // Recent sessions (last 7 days)
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const recentSessions = await prisma.session.count({
    where: {
      modelId: modelId,
      sessionStart: {
        gte: sevenDaysAgo,
      },
    },
  });

  // Earnings this month
  const firstDayOfMonth = new Date();
  firstDayOfMonth.setDate(1);
  firstDayOfMonth.setHours(0, 0, 0, 0);

  const monthlyEarnings = await prisma.session.aggregate({
    where: {
      modelId: modelId,
      sessionStart: {
        gte: firstDayOfMonth,
      },
      paymentStatus: "paid",
    },
    _sum: {
      totalCost: true,
    },
  });

  return {
    totalBookings,
    pendingBookings,
    totalSessions,
    totalLikes,
    rating: model?.rating || 0,
    totalReviews: model?.total_review || 0,
    recentSessions,
    monthlyEarnings: monthlyEarnings._sum.totalCost || 0,
  };
}

export async function getModelReviews(modelId: string, limit = 20) {
  return await prisma.review.findMany({
    where: {
      modelId: modelId,
    },
    include: {
      customer: {
        select: {
          firstName: true,
          lastName: true,
          profile: true,
        },
      },
      session: {
        select: {
          sessionStart: true,
          duration: true,
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
    take: limit,
  });
}

export async function getModelFriendContacts(modelId: string) {
  return await prisma.friend_contacts.findMany({
    where: {
      modelId: modelId,
    },
    include: {
      customer: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          profile: true,
          gender: true,
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });
}

export async function addModelImage(modelId: string, imageName: string) {
  return await prisma.images.create({
    data: {
      name: imageName,
      status: "active",
      modelId: modelId,
    },
  });
}

export async function deleteModelImage(imageId: string, modelId: string) {
  const image = await prisma.images.findFirst({
    where: {
      id: imageId,
      modelId: modelId,
    },
  });

  if (!image) {
    throw new Error("Image not found or does not belong to this model");
  }

  return await prisma.images.delete({
    where: { id: imageId },
  });
}

// ========================================  Model-Side Matches Functions (For viewing customers)

export async function getForYouCustomers(
  modelId: string,
  options: {
    page?: number;
    perPage?: number;
    maxDistance?: number;
    ageRange?: [number, number];
    minRating?: number;
    gender?: string;
    location?: string;
    relationshipStatus?: string;
    modelLat?: number;
    modelLng?: number;
  } = {}
) {
  const {
    page = 1,
    perPage = 20,
    maxDistance,
    ageRange,
    minRating,
    gender,
    location,
    relationshipStatus,
    modelLat,
    modelLng,
  } = options;

  const skip = (page - 1) * perPage;

  // Get customers that the model has PASSED (exclude only PASS, not LIKE)
  const passedCustomers = await prisma.model_interactions.findMany({
    where: {
      modelId,
      action: "PASS", // Only exclude customers the model passed on
    },
    select: { customerId: true },
  });

  const passedCustomerIds = passedCustomers.map((i) => i.customerId);

  // Build the where clause - only exclude PASSED customers
  const whereClause: any = {
    status: "active",
    id: {
      notIn: passedCustomerIds, // Exclude only passed customers, keep liked ones
    },
  };

  // Apply filters
  if (gender) {
    whereClause.gender = gender;
  }

  if (location) {
    whereClause.location = location;
  }

  if (relationshipStatus) {
    whereClause.relationshipStatus = relationshipStatus;
  }

  // Age range filter
  // To include someone aged X, they could be born anywhere from (today - X - 1 years + 1 day) to (today - X years)
  // For age range [minAge, maxAge]:
  // - Youngest (minAge): DOB <= (today - minAge years)
  // - Oldest (maxAge): DOB > (today - maxAge - 1 years) which means DOB >= (today - maxAge - 1 years + 1 day)
  if (ageRange) {
    const today = new Date();
    // maxDate: youngest person in range (age = minAge)
    const maxDate = new Date(
      today.getFullYear() - ageRange[0],
      today.getMonth(),
      today.getDate()
    );
    // minDate: oldest person in range (age = maxAge, could be born up to almost maxAge+1 years ago)
    const minDate = new Date(
      today.getFullYear() - ageRange[1] - 1,
      today.getMonth(),
      today.getDate() + 1
    );
    whereClause.dob = {
      gte: minDate,
      lte: maxDate,
    };
  }

  // Get total count for pagination
  const totalCount = await prisma.customer.count({ where: whereClause });

  // Get customers with their interactions
  const customers = await prisma.customer.findMany({
    where: whereClause,
    include: {
      Images: {
        where: { status: "active" },
        select: {
          id: true,
          name: true,
        },
        take: 5,
      },
      model_interactions: {
        where: { modelId },
        select: {
          action: true,
        },
      },
      friend_contacts: {
        where: {
          // adderType: "MODEL",
          modelId: modelId,
          // contactType: "CUSTOMER",
        },
        select: {
          id: true,
          customerId: true,
          contactType: true,
        },
      },
    },
    orderBy: [{ createdAt: "desc" }],
    skip,
    take: perPage,
  });

  // Calculate distance if coordinates provided
  let customersWithDistance = customers;
  if (maxDistance && modelLat && modelLng) {
    customersWithDistance = customers.filter((customer) => {
      if (!customer.latitude || !customer.longitude) return false;
      const distance = calculateDistance(
        Number(customer.latitude),
        Number(customer.longitude),
        modelLat,
        modelLng
      );
      return distance <= maxDistance;
    });
  }

  // Add derived fields (isContact, modelAction)
  const enhancedCustomers = customersWithDistance.map((customer) => ({
    ...customer,
    isContact: customer.friend_contacts.length > 0,
    modelAction:
      customer.model_interactions.length > 0
        ? customer.model_interactions[0].action
        : null,
  }));

  const totalPages = Math.ceil(totalCount / perPage);

  return {
    customers: enhancedCustomers,
    pagination: {
      currentPage: page,
      totalPages,
      totalCount,
      limit: perPage,
      hasNextPage: page < totalPages,
      hasPreviousPage: page > 1,
    },
  };
}

export async function getCustomersWhoLikedMe(
  modelId: string,
  page: number = 1,
  perPage: number = 20
) {
  const skip = (page - 1) * perPage;

  const totalCount = await prisma.customer_interactions.count({
    where: {
      modelId,
      action: "LIKE",
    },
  });

  const interactions = await prisma.customer_interactions.findMany({
    where: {
      modelId,
      action: "LIKE",
    },
    include: {
      customer: {
        include: {
          Images: {
            where: { status: "active" },
            select: {
              id: true,
              name: true,
            },
            take: 5,
          },
          model_interactions: {
            where: { modelId },
            select: {
              action: true,
            },
          },
          friend_contacts: {
            where: {
              modelId: modelId,
            },
            select: {
              id: true,
              customerId: true,
              contactType: true,
            },
          },
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
    skip,
    take: perPage,
  });

  // Add isContact and modelAction derived fields
  const customers = interactions.map((i) => ({
    ...i.customer,
    isContact: i.customer.friend_contacts.length > 0,
    modelAction:
      i.customer.model_interactions.length > 0
        ? i.customer.model_interactions[0].action
        : null,
  }));

  const totalPages = Math.ceil(totalCount / perPage);

  return {
    customers,
    pagination: {
      currentPage: page,
      totalPages,
      totalCount,
      limit: perPage,
      hasNextPage: page < totalPages,
      hasPreviousPage: page > 1,
    },
  };
}

export async function getCustomersByModelInteraction(
  modelId: string,
  action: "LIKE" | "PASS",
  page: number = 1,
  perPage: number = 20
) {
  const skip = (page - 1) * perPage;

  const totalCount = await prisma.model_interactions.count({
    where: {
      modelId,
      action,
    },
  });

  const interactions = await prisma.model_interactions.findMany({
    where: {
      modelId,
      action,
    },
    include: {
      customer: {
        include: {
          Images: {
            where: { status: "active" },
            select: {
              id: true,
              name: true,
            },
            take: 5,
          },
          model_interactions: {
            where: { modelId },
            select: {
              action: true,
            },
          },
          friend_contacts: {
            where: {
              modelId: modelId,
            },
            select: {
              id: true,
              customerId: true,
              contactType: true,
            },
          },
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
    skip,
    take: perPage,
  });

  // Add isContact and modelAction derived fields
  const customers = interactions.map((i) => ({
    ...i.customer,
    isContact: i.customer.friend_contacts.length > 0,
    modelAction:
      i.customer.model_interactions.length > 0
        ? i.customer.model_interactions[0].action
        : null,
  }));

  const totalPages = Math.ceil(totalCount / perPage);

  return {
    customers,
    pagination: {
      currentPage: page,
      totalPages,
      totalCount,
      limit: perPage,
      hasNextPage: page < totalPages,
      hasPreviousPage: page > 1,
    },
  };
}

export async function createModelInteraction(
  modelId: string,
  customerId: string,
  action: "LIKE" | "PASS"
) {
  // Check if interaction already exists
  const existingInteraction = await prisma.model_interactions.findFirst({
    where: {
      modelId,
      customerId,
    },
  });

  if (existingInteraction) {
    // If same action exists, delete it (toggle off / unlike / unpass)
    if (existingInteraction.action === action) {
      await prisma.model_interactions.delete({
        where: { id: existingInteraction.id },
      });

      return {
        success: true,
        message: `Successfully ${action === "LIKE" ? "unliked" : "unpassed"} customer`,
      };
    }

    // If different action exists, update it
    await prisma.model_interactions.update({
      where: { id: existingInteraction.id },
      data: { action },
    });

    // Send notification if changing to LIKE
    if (action === "LIKE") {
      try {
        const model = await prisma.model.findUnique({
          where: { id: modelId },
          select: { firstName: true, lastName: true },
        });
        const modelName = model
          ? `${model.firstName || ""} ${model.lastName || ""}`.trim()
          : "Someone";
        await notifyCustomerLikeReceived(customerId, modelId, modelName);
      } catch (notifyError) {
        console.error("Failed to send like notification:", notifyError);
      }
    }

    return {
      success: true,
      message: `Successfully ${action === "LIKE" ? "liked" : "passed"} customer`,
    };
  }

  // Create new interaction
  await prisma.model_interactions.create({
    data: {
      modelId,
      customerId,
      action,
    },
  });

  // Send notification when model likes a customer
  if (action === "LIKE") {
    try {
      const model = await prisma.model.findUnique({
        where: { id: modelId },
        select: { firstName: true, lastName: true },
      });
      const modelName = model
        ? `${model.firstName || ""} ${model.lastName || ""}`.trim()
        : "Someone";
      await notifyCustomerLikeReceived(customerId, modelId, modelName);
    } catch (notifyError) {
      console.error("Failed to send like notification:", notifyError);
    }
  }

  return {
    success: true,
    message: `Successfully ${action === "LIKE" ? "liked" : "passed"} customer`,
  };
}

// ========================================
// Model Services Management
// ========================================

export async function getAllServices() {
  return await prisma.service.findMany({
    where: {
      status: "active",
    },
    orderBy: {
      createdAt: "desc",
    },
  });
}

export async function getModelAppliedServices(modelId: string) {
  return await prisma.model_service.findMany({
    where: {
      modelId,
      status: "active",
    },
    include: {
      service: true,
    },
    orderBy: {
      createdAt: "desc",
    },
  });
}

export async function updateModelServiceAvailability(
  modelServiceId: string,
  isAvailable: boolean,
  modelId: string
) {
  // Verify the model_service belongs to the model
  const modelService = await prisma.model_service.findFirst({
    where: {
      id: modelServiceId,
      modelId,
    },
  });

  if (!modelService) {
    throw new Error("Service not found or does not belong to this model");
  }

  return await prisma.model_service.update({
    where: {
      id: modelServiceId,
    },
    data: {
      isAvailable,
    },
  });
}

// Update model password
export async function updateModelPassword(
  modelId: string,
  oldPassword: string,
  newPassword: string
) {
  if (!modelId || !oldPassword || !newPassword) {
    throw new FieldValidationError({
      success: false,
      error: true,
      message: "Invalid credentials inputs!",
    });
  }

  const auditBase = {
    action: "UPDATE_MODEL_PASSWORD",
    model: modelId,
  };

  try {
    const existingModel = await prisma.model.findUnique({
      where: {
        id: modelId,
      },
    });

    if (!existingModel) {
      throw new FieldValidationError({
        success: false,
        error: true,
        message: "Model does not exist!",
      });
    }

    const passwordCorrect = await compare(oldPassword, existingModel.password);
    if (!passwordCorrect) {
      await createAuditLogs({
        ...auditBase,
        description: `Password change failed, old password incorrect!`,
        status: "failed",
        onError: "Old password does not match the password from database!",
      });
      throw new FieldValidationError({
        success: false,
        error: true,
        message: "Your old password is incorrect!",
      });
    }

    const passwordHash = await hash(newPassword, 12);

    const updatedModel = await prisma.model.update({
      where: {
        id: existingModel.id,
      },
      data: {
        password: passwordHash,
      },
    });

    if (updatedModel.id) {
      await createAuditLogs({
        ...auditBase,
        description: `Update model: ${updatedModel.id} password successfully.`,
        status: "success",
        onSuccess: updatedModel,
      });
    }

    return {
      success: true,
      message: "Password updated successfully!",
    };
  } catch (error: any) {
    console.error("UPDATE_MODEL_PASSWORD_FAILED", error);
    await createAuditLogs({
      ...auditBase,
      description: `Update model password failed!`,
      status: "failed",
      onError: error,
    });

    if (error instanceof FieldValidationError) {
      throw error;
    }

    throw new FieldValidationError({
      success: false,
      error: true,
      message: "Failed to update password!",
    });
  }
}

export async function createModelReport(
  modelId: string,
  type: string,
  title: string,
  description: string
) {
  const auditBase = {
    action: "CREATE_MODEL_REPORT",
    model: modelId,
  };

  try {
    // Validation
    if (!modelId || !type || !title || !description) {
      await createAuditLogs({
        ...auditBase,
        description: "Report creation failed - missing required fields!",
        status: "failed",
        onError: "Missing required fields!",
      });
      throw new FieldValidationError({
        success: false,
        error: true,
        message: "All fields are required!",
      });
    }

    // Verify model exists
    const existingModel = await prisma.model.findUnique({
      where: { id: modelId },
      select: { id: true, firstName: true, lastName: true },
    });

    if (!existingModel) {
      await createAuditLogs({
        ...auditBase,
        description: "Report creation failed - model not found!",
        status: "failed",
        onError: "Model not found!",
      });
      throw new FieldValidationError({
        success: false,
        error: true,
        message: "Model not found!",
      });
    }

    // Create report
    const report = await prisma.reports.create({
      data: {
        type,
        title,
        description,
        modelId,
      },
    });

    if (report.id) {
      await createAuditLogs({
        ...auditBase,
        description: `Model ${existingModel.firstName} ${existingModel.lastName || ""} submitted a report: ${title}`,
        status: "success",
        onSuccess: report,
      });
    }

    return {
      success: true,
      message:
        "Report submitted successfully! We'll review it as soon as possible.",
      data: report,
    };
  } catch (error: any) {
    console.error("CREATE_MODEL_REPORT_FAILED", error);
    await createAuditLogs({
      ...auditBase,
      description: "Report creation failed!",
      status: "failed",
      onError: error,
    });

    if (error instanceof FieldValidationError) {
      throw error;
    }

    throw new FieldValidationError({
      success: false,
      error: true,
      message: "Failed to submit report!",
    });
  }
}

export async function deleteModelAccount(
  modelId: string,
  password: string,
  reason?: string
) {
  const auditBase = {
    action: "DELETE_MODEL_ACCOUNT",
    model: modelId,
  };

  try {
    // Validation
    if (!modelId || !password) {
      await createAuditLogs({
        ...auditBase,
        description: "Account deletion failed - missing required fields!",
        status: "failed",
        onError: "Missing required fields!",
      });
      throw new FieldValidationError({
        success: false,
        error: true,
        message: "Password is required!",
      });
    }

    // Verify model exists and get password
    const existingModel = await prisma.model.findUnique({
      where: { id: modelId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        password: true,
        username: true,
      },
    });

    if (!existingModel) {
      await createAuditLogs({
        ...auditBase,
        description: "Account deletion failed - model not found!",
        status: "failed",
        onError: "Model not found!",
      });
      throw new FieldValidationError({
        success: false,
        error: true,
        message: "Model not found!",
      });
    }

    // Verify password
    const passwordCorrect = await compare(password, existingModel.password);
    if (!passwordCorrect) {
      await createAuditLogs({
        ...auditBase,
        description: "Account deletion failed - incorrect password!",
        status: "failed",
        onError: "Incorrect password!",
      });
      throw new FieldValidationError({
        success: false,
        error: true,
        message: "Incorrect password! Please try again.",
      });
    }

    // Mark account as deleted (soft delete)
    const deletedModel = await prisma.model.update({
      where: { id: existingModel.id },
      data: {
        status: "deleted",
        username: `deleted_${existingModel.username}_${Date.now()}`, // Prevent username conflicts
      },
    });

    // Log successful deletion
    await createAuditLogs({
      ...auditBase,
      description: `Model ${existingModel.firstName} ${existingModel.lastName || ""} (${existingModel.username}) deleted their account${reason ? `. Reason: ${reason}` : ""}`,
      status: "success",
      onSuccess: {
        modelId: deletedModel.id,
        username: existingModel.username,
        deletedAt: new Date(),
        reason: reason || "Not provided",
      },
    });

    return {
      success: true,
      message: "Your account has been permanently deleted.",
    };
  } catch (error: any) {
    console.error("DELETE_MODEL_ACCOUNT_FAILED", error);
    await createAuditLogs({
      ...auditBase,
      description: "Account deletion failed!",
      status: "failed",
      onError: error,
    });

    if (error instanceof FieldValidationError) {
      throw error;
    }

    throw new FieldValidationError({
      success: false,
      error: true,
      message: "Failed to delete account!",
    });
  }
}
