import { prisma } from "./database.server";
import { default as bcrypt } from "bcryptjs";
import { differenceInYears } from "date-fns";
import { createAuditLogs } from "./log.server";
import { FieldValidationError } from "./base.server";
import { notifyCustomerLikeReceived } from "./notification.server";
import { withCache, cacheInvalidateContaining, stableStringify } from "./cache.server";
import { visibleGendersFor } from "~/utils/gender";

// Cache TTL for discover/matches list queries. Short enough that fresh
// signups appear quickly, long enough that back-navigation and rapid
// tab-switching hit memory instead of Mongo. Every action that mutates
// the customer's own view (like/pass/addFriend) also invalidates.
const LIST_CACHE_TTL_MS = 30_000;

const { compare, hash } = bcrypt;

// Base condition: only show models who have at least one open service
const OPEN_SERVICE_CONDITION = {
  ModelService: {
    some: {
      status: "active",
      isAvailable: true,
      service: { status: "active" },
    },
  },
};

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

interface DiscoverFilters {
  search?: string;
  services?: string[]; // Service names: massage, drinkingFriend, travelingPartner, talkingPartner
  maxDistance?: number;
  ageRange?: [number, number];
  gender?: string;
  minRating?: number;
}

// Discover page - Get online/active models that customer hasn't passed
export async function getModelsForCustomer(
  customerId: string,
  filters: DiscoverFilters = {}
) {
  return withCache(
    `modelsForCustomer:${customerId}:${stableStringify(filters)}`,
    LIST_CACHE_TTL_MS,
    () => _getModelsForCustomer(customerId, filters)
  );
}

async function _getModelsForCustomer(
  customerId: string,
  filters: DiscoverFilters
) {
  try {
    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
      select: { latitude: true, longitude: true, gender: true },
    });

    // Build where clause with filters
    const whereClause: any = {
      status: "active",
      isProfileHidden: { not: true },
      ...OPEN_SERVICE_CONDITION,
      customer_interactions: {
        none: {
          customerId,
          action: "PASS",
        },
      },
    };

    // Search filter (firstName or lastName)
    if (filters.search) {
      whereClause.OR = [
        { firstName: { contains: filters.search, mode: "insensitive" } },
        { lastName: { contains: filters.search, mode: "insensitive" } },
      ];
    }

    // Gender filter
    // Gender comes from the viewer's account, not a UI filter — male sees
    // female, female sees male, `other` is mutually visible. `filters.gender`
    // is ignored: the manual female/male tabs were removed. See utils/gender.
    const allowedGenders = visibleGendersFor(customer?.gender);
    if (allowedGenders) {
      whereClause.gender = { in: allowedGenders };
    }

    // Rating filter
    if (filters.minRating) {
      whereClause.rating = { gte: filters.minRating };
    }

    // Services filter - models who have these specific services available
    if (filters.services && filters.services.length > 0) {
      whereClause.ModelService = {
        some: {
          status: "active",
          isAvailable: true,
          service: {
            name: { in: filters.services },
            status: "active",
          },
        },
      };
    }

    // Push age + distance-bbox into Mongo so the take:20 window actually
    // contains 20 matches after filtering. The old code was fetching 20
    // by rating, then JS-filtering by age, potentially returning near-empty.
    const dobRange = ageRangeToDobRange(filters.ageRange);
    if (dobRange) whereClause.dob = dobRange;
    const bbox = boundingBoxFilter(
      customer?.latitude,
      customer?.longitude,
      filters.maxDistance
    );
    if (bbox) {
      whereClause.latitude = bbox.latRange;
      whereClause.longitude = bbox.lngRange;
    }

    const models = await prisma.model.findMany({
      where: whereClause,
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
        profileHiddenByAdmin: true,
        rating: true,
        total_review: true,
        latitude: true,
        longitude: true,
        available_status: true,
        vip: true,
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
        ModelService: {
          where: { status: "active", isAvailable: true },
          select: {
            service: {
              select: { name: true },
            },
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

    // Age + distance-bbox already enforced in Mongo. Precise distance
    // haversine runs below (the bbox is a square, we want a circle).
    let filteredModels = models;

    if (filters.maxDistance && customer?.latitude && customer?.longitude) {
      filteredModels = filteredModels.filter((model) => {
        if (!model.latitude || !model.longitude) return true;
        const distance = calculateDistance(
          customer.latitude!,
          customer.longitude!,
          model.latitude,
          model.longitude
        );
        return distance <= filters.maxDistance!;
      });
    }

    // Calculate distance and enhance models
    return filteredModels.map((model) => {
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
        services: model.ModelService.filter((ms) => ms.service).map((ms) => ms.service!.name),
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

// Turn an [minAge, maxAge] tuple into a { gte, lte } date range on `dob`
// so the age filter runs in Mongo instead of after loading every row.
// Someone `minAge` years old today was born at most `minAge` years ago,
// someone `maxAge` years old was born at least `maxAge + 1` years ago.
function ageRangeToDobRange(
  ageRange?: [number, number]
): { gte: Date; lte: Date } | null {
  if (!ageRange) return null;
  const [minAge, maxAge] = ageRange;
  const now = new Date();
  const maxDob = new Date(now.getFullYear() - minAge, now.getMonth(), now.getDate());
  const minDob = new Date(now.getFullYear() - maxAge - 1, now.getMonth(), now.getDate() + 1);
  return { gte: minDob, lte: maxDob };
}

// Build a rough lat/lng bounding-box filter for Mongo. A square bounds
// the circle we actually want — the exact-distance haversine still runs
// in JS on the ~10-100 rows the box lets through, instead of on every
// active model in the DB.
function boundingBoxFilter(
  centerLat?: number | null,
  centerLng?: number | null,
  maxDistanceKm?: number
): { latRange: { gte: number; lte: number }; lngRange: { gte: number; lte: number } } | null {
  if (!maxDistanceKm || !centerLat || !centerLng) return null;
  const latDelta = maxDistanceKm / 111; // ~111 km per degree of latitude
  const lngDelta = maxDistanceKm / (111 * Math.cos((centerLat * Math.PI) / 180) || 1);
  return {
    latRange: { gte: centerLat - latDelta, lte: centerLat + latDelta },
    lngRange: { gte: centerLng - lngDelta, lte: centerLng + lngDelta },
  };
}

// Pagination options for nearby models
interface NearbyModelsPaginationOptions {
  page?: number;
  limit?: number;
}

// Get nearby models based on geolocation distance with pagination support
export async function getNearbyModels(
  customerId: string,
  filters: DiscoverFilters = {},
  maxDistanceKm: number = 50,
  pagination: NearbyModelsPaginationOptions = {}
) {
  return withCache(
    `nearbyModels:${customerId}:${maxDistanceKm}:${stableStringify(filters)}:${stableStringify(pagination)}`,
    LIST_CACHE_TTL_MS,
    () => _getNearbyModels(customerId, filters, maxDistanceKm, pagination)
  );
}

async function _getNearbyModels(
  customerId: string,
  filters: DiscoverFilters,
  maxDistanceKm: number,
  pagination: NearbyModelsPaginationOptions
) {
  const { page = 1, limit = 50 } = pagination;
  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
    select: {
      latitude: true,
      longitude: true,
      gender: true, // Use for opposite gender matching
    },
  });

  // If customer location is missing or invalid, return empty results
  // This allows the page to load and prompt the user to enable location
  if (!customer?.latitude || !customer?.longitude ||
      (customer.latitude === 0 && customer.longitude === 0)) {
    return {
      models: [],
      pagination: {
        page,
        limit,
        totalCount: 0,
        hasMore: false,
      },
    };
  }

  // Build where clause with filters
  const whereClause: any = {
    latitude: { not: null },
    longitude: { not: null },
    status: "active",
    isProfileHidden: { not: true },
    ...OPEN_SERVICE_CONDITION,
    // Exclude models the customer has passed
    customer_interactions: {
      none: {
        customerId,
        action: "PASS",
      },
    },
  };

  // Search filter (firstName or lastName)
  if (filters.search) {
    whereClause.OR = [
      { firstName: { contains: filters.search, mode: "insensitive" } },
      { lastName: { contains: filters.search, mode: "insensitive" } },
    ];
  }

  // Gender is decided by the viewer's own account, not by a UI filter:
  // male sees female, female sees male, `other` sees everyone and is visible
  // to everyone. See app/utils/gender.ts. `filters.gender` is deliberately
  // ignored here — the manual female/male tabs were removed.
  const allowedGenders = visibleGendersFor(customer.gender);
  if (allowedGenders) {
    whereClause.gender = { in: allowedGenders };
  }

  // Rating filter
  if (filters.minRating) {
    whereClause.rating = { gte: filters.minRating };
  }

  // Services filter - models who have these specific services available
  if (filters.services && filters.services.length > 0) {
    whereClause.ModelService = {
      some: {
        status: "active",
        isAvailable: true,
        service: {
          name: { in: filters.services },
          status: "active",
        },
      },
    };
  }

  // Push age into Mongo — was previously "load all, filter in JS".
  const dobRange = ageRangeToDobRange(filters.ageRange);
  if (dobRange) whereClause.dob = dobRange;

  // Rough bounding-box pre-filter for distance. Precise haversine still
  // runs below on the narrow slice this returns. Uses the caller's
  // effective max distance (URL filter overrides the function default).
  const effectiveMaxDistance = filters.maxDistance || maxDistanceKm;
  const bbox = boundingBoxFilter(customer.latitude, customer.longitude, effectiveMaxDistance);
  if (bbox) {
    whereClause.latitude = bbox.latRange;
    whereClause.longitude = bbox.lngRange;
  }

  const NEARBY_HARD_CAP = 500;
  const models = await prisma.model.findMany({
    where: whereClause,
    take: NEARBY_HARD_CAP,
    select: {
      id: true,
      firstName: true,
      lastName: true,
      dob: true,
      gender: true,
      bio: true,
      whatsapp: true,
      profile: true,
      profileHiddenByAdmin: true,
      latitude: true,
      longitude: true,
      address: true,
      status: true,
      rating: true,
      total_review: true,
      available_status: true,
      vip: true,
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
      ModelService: {
        where: { status: "active", isAvailable: true },
        select: {
          service: {
            select: { name: true },
          },
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

  // Age already enforced by Mongo above — no need to re-filter here.
  const filteredModels = models;

  // Calculate distance and filter by maxDistance
  const allModelsWithDistance = filteredModels
    .map((m) => {
      const distance = calculateDistance(
        customer.latitude!,
        customer.longitude!,
        m.latitude!,
        m.longitude!
      );

      return {
        ...m,
        profile: m.profile,
        distance: Number(distance.toFixed(2)),
        isContact: m.friend_contacts.length > 0,
        customerAction:
          m.customer_interactions.length > 0
            ? m.customer_interactions[0].action
            : null,
        totalLikes: m._count.customer_interactions,
        services: m.ModelService.filter((ms) => ms.service).map((ms) => ms.service!.name),
      };
    })
    .filter((m) => m.distance <= effectiveMaxDistance) // Filter by max distance
    .sort((a, b) => {
      // Sort by distance first, then by rating
      if (a.distance !== b.distance) {
        return a.distance - b.distance;
      }
      return b.rating - a.rating;
    });

  // Apply pagination
  const totalCount = allModelsWithDistance.length;
  const skip = (page - 1) * limit;
  const paginatedModels = allModelsWithDistance.slice(skip, skip + limit);
  const hasMore = skip + limit < totalCount;

  return {
    models: paginatedModels,
    pagination: {
      page,
      limit,
      totalCount,
      hasMore,
    },
  };
}

// Get all VIP models (no gender filter)
export async function getVipModels(customerId: string) {
  return withCache(
    `vipModels:${customerId}`,
    LIST_CACHE_TTL_MS,
    () => _getVipModels(customerId)
  );
}

async function _getVipModels(customerId: string) {
  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
    select: { latitude: true, longitude: true },
  });

  // VIP tab is a rating-sorted carousel. 100 rows is far more than any
  // customer will ever scroll — the old unbounded query was the discover
  // page's second-worst offender after getNearbyModels.
  const models = await prisma.model.findMany({
    where: {
      status: "active",
      vip: true,
      isProfileHidden: { not: true },
      ...OPEN_SERVICE_CONDITION,
    },
    take: 100,
    orderBy: [{ rating: "desc" }, { updatedAt: "desc" }],
    select: {
      id: true,
      firstName: true,
      lastName: true,
      dob: true,
      gender: true,
      bio: true,
      whatsapp: true,
      profile: true,
      profileHiddenByAdmin: true,
      latitude: true,
      longitude: true,
      address: true,
      status: true,
      rating: true,
      total_review: true,
      available_status: true,
      vip: true,
      updatedAt: true,
      Images: {
        take: 5,
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
          customerId,
          contactType: "MODEL",
        },
        select: { id: true, modelId: true, contactType: true },
      },
      ModelService: {
        where: { status: "active", isAvailable: true },
        select: { service: { select: { name: true } } },
      },
      _count: {
        select: { customer_interactions: { where: { action: "LIKE" } } },
      },
    },
  });

  return models.map((m) => {
    const distance = customer?.latitude && customer?.longitude && m.latitude && m.longitude
      ? Number(calculateDistance(customer.latitude, customer.longitude, m.latitude, m.longitude).toFixed(2))
      : null;

    return {
      ...m,
      profile: m.profile,
      distance,
      isContact: m.friend_contacts.length > 0,
      customerAction: m.customer_interactions.length > 0 ? m.customer_interactions[0].action : null,
      totalLikes: m._count.customer_interactions,
      services: m.ModelService.filter((ms) => ms.service).map((ms) => ms.service!.name),
    };
  });
}

// Search ALL active models by firstName, lastName, or whatsapp number
export async function searchModels(customerId: string, query: string) {
  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
    select: { latitude: true, longitude: true },
  });

  const orConditions: any[] = [
    { firstName: { contains: query, mode: "insensitive" } },
    { lastName: { contains: query, mode: "insensitive" } },
  ];

  // If query looks like a number, also search by whatsapp
  const numericQuery = query.replace(/\D/g, "");
  if (numericQuery.length >= 2) {
    orConditions.push({
      whatsapp: { equals: parseInt(numericQuery, 10) },
    });
  }

  const models = await prisma.model.findMany({
    where: {
      status: "active",
      isProfileHidden: { not: true },
      ...OPEN_SERVICE_CONDITION,
      OR: orConditions,
    },
    take: 20,
    orderBy: [{ rating: "desc" }, { updatedAt: "desc" }],
    select: {
      id: true,
      firstName: true,
      lastName: true,
      dob: true,
      gender: true,
      bio: true,
      whatsapp: true,
      profile: true,
      profileHiddenByAdmin: true,
      latitude: true,
      longitude: true,
      address: true,
      status: true,
      rating: true,
      total_review: true,
      available_status: true,
      vip: true,
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
          customerId,
          contactType: "MODEL",
        },
        select: { id: true, modelId: true, contactType: true },
      },
      ModelService: {
        where: { status: "active", isAvailable: true },
        select: { service: { select: { name: true } } },
      },
      _count: {
        select: {
          customer_interactions: { where: { action: "LIKE" } },
        },
      },
    },
  });

  return models.map((m) => {
    const distance =
      customer?.latitude && customer?.longitude && m.latitude && m.longitude
        ? Number(
            calculateDistance(
              customer.latitude,
              customer.longitude,
              m.latitude,
              m.longitude
            ).toFixed(2)
          )
        : 0;

    return {
      ...m,
      profile: m.profile,
      distance,
      isContact: m.friend_contacts.length > 0,
      customerAction:
        m.customer_interactions.length > 0
          ? m.customer_interactions[0].action
          : null,
      totalLikes: m._count.customer_interactions,
      services: m.ModelService.filter((ms) => ms.service).map(
        (ms) => ms.service!.name
      ),
    };
  });
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
        isProfileHidden: { not: true },
        ...OPEN_SERVICE_CONDITION,
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
        profileHiddenByAdmin: true,
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
        profile: model.profile,
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

// Get hot/trending models for public view (no authentication required)
export async function getPublicHotModels(limit: number = 12) {
  try {
    const hotModels = await prisma.model.findMany({
      where: {
        status: "active",
        isProfileHidden: { not: true },
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        dob: true,
        gender: true,
        bio: true,
        profile: true,
        profileHiddenByAdmin: true,
        rating: true,
        total_review: true,
        address: true,
        available_status: true,
        updatedAt: true,
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
        _count: {
          select: {
            customer_interactions: {
              where: { action: "LIKE" },
            },
            Review: true,
          },
        },
      },
      orderBy: [
        { rating: "desc" },
        { updatedAt: "desc" },
      ],
      take: limit,
    });

    // Calculate hot score and sort
    const modelsWithScore = hotModels.map((model) => {
      const likesCount = model._count.customer_interactions || 0;
      const reviewsCount = model._count.Review || 0;
      const ratingScore = (model.rating || 0) * 20;

      // Calculate recency score (models updated recently get higher score)
      const daysSinceUpdate = Math.floor(
        (Date.now() - new Date(model.updatedAt).getTime()) / (1000 * 60 * 60 * 24)
      );
      const recencyScore = Math.max(0, 100 - daysSinceUpdate * 2);

      const hotScore = likesCount * 10 + reviewsCount * 5 + ratingScore + recencyScore;

      return {
        ...model,
        profile: model.profile,
        hotScore,
      };
    });

    // Sort by hot score descending
    const sortedModels = modelsWithScore.sort((a, b) => b.hotScore - a.hotScore);

    return sortedModels;
  } catch (error: any) {
    console.log("GET_PUBLIC_HOT_MODELS_ERROR:", error);
    return [];
  }
}

export async function getModelProfile(modelId: string, customerId: string) {
  try {
    const model = await prisma.model.findFirst({
      where: {
        id: modelId,
        status: "active",
        isProfileHidden: { not: true },
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
        profileHiddenByAdmin: true,
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
            customMinuteRate: true,
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
                minuteRate: true,
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
      profile: model.profile,
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
        customMinuteRate: true,
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
            minuteRate: true,
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
  return withCache(
    `foryouModels:${customerId}:${stableStringify(filters)}`,
    LIST_CACHE_TTL_MS,
    () => _getForyouModels(customerId, filters)
  );
}

async function _getForyouModels(
  customerId: string,
  filters: ForYouFilters
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

    // Push filters into the Mongo query so we don't materialise every
    // active model in memory. Historic behaviour was "load everything,
    // JS-filter" which scaled linearly with total model count.
    const dobRange = ageRangeToDobRange(filters.ageRange);
    const bbox = boundingBoxFilter(
      customer?.latitude,
      customer?.longitude,
      filters.maxDistance
    );

    // Fetch a bounded window of models pre-filtered in Mongo. The final
    // in-JS pass still runs a precise haversine — the bounding box is a
    // rough sieve that eliminates the vast majority before we pull rows.
    const HARD_CAP = 300;
    const allModels = await prisma.model.findMany({
      where: {
        status: "active",
        isProfileHidden: { not: true },
        ...OPEN_SERVICE_CONDITION,
        ...(filters.gender ? { gender: filters.gender } : {}),
        ...(filters.location
          ? { address: { contains: filters.location } }
          : {}),
        ...(filters.minRating ? { rating: { gte: filters.minRating } } : {}),
        ...(filters.relationshipStatus
          ? { available_status: filters.relationshipStatus }
          : {}),
        ...(dobRange ? { dob: dobRange } : {}),
        ...(bbox ? { latitude: bbox.latRange, longitude: bbox.lngRange } : {}),
        NOT: {
          customer_interactions: {
            some: {
              customerId,
              action: "PASS",
            },
          },
        },
      },
      take: HARD_CAP,
      orderBy: [{ rating: "desc" }, { updatedAt: "desc" }],
      select: {
        id: true,
        firstName: true,
        lastName: true,
        dob: true,
        profile: true,
        profileHiddenByAdmin: true,
        whatsapp: true,
        latitude: true,
        longitude: true,
        address: true,
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

    // Distance still needs a precise haversine pass — the Mongo bounding
    // box is a rough square, not a circle. Age is already enforced by
    // the DB, no need to re-check.
    const filteredModels =
      filters.maxDistance && customer?.latitude && customer?.longitude
        ? allModels.filter((m) => {
            if (!m.latitude || !m.longitude) return false;
            const distance = calculateDistance(
              customer.latitude!,
              customer.longitude!,
              m.latitude,
              m.longitude
            );
            return distance <= filters.maxDistance!;
          })
        : allModels;

    // Add derived fields (isContact, customerAction)
    const enhancedModels = filteredModels.map((model) => ({
      ...model,
      profile: model.profile,
      customerAction:
        model.customer_interactions.length > 0
          ? model.customer_interactions[0].action
          : null,
      isContact: model.friend_contacts.length > 0,
    }));

    // Shuffle to show different models each visit
    for (let i = enhancedModels.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [enhancedModels[i], enhancedModels[j]] = [enhancedModels[j], enhancedModels[i]];
    }

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
          isProfileHidden: { not: true },
          ...OPEN_SERVICE_CONDITION,
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
          profileHiddenByAdmin: true,
          whatsapp: true,
          latitude: true,
          longitude: true,
          address: true,
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
          isProfileHidden: { not: true },
          ...OPEN_SERVICE_CONDITION,
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
      profile: model.profile,
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
          isProfileHidden: { not: true },
          ...OPEN_SERVICE_CONDITION,
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
          profileHiddenByAdmin: true,
          whatsapp: true,
          latitude: true,
          longitude: true,
          address: true,
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
          isProfileHidden: { not: true },
          ...OPEN_SERVICE_CONDITION,
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
      profile: model.profile,
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
          totalPending: true,
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

  // The viewer's own gender drives who they see (male<->female, `other`
  // mutually visible). Loaded here rather than trusting an option, so the
  // rule can't be bypassed by a caller passing `gender`.
  const viewer = await prisma.model.findUnique({
    where: { id: modelId },
    select: { gender: true },
  });
  const allowedGenders = visibleGendersFor(viewer?.gender);

  // Build the where clause - only exclude PASSED customers
  const whereClause: any = {
    status: "active",
    id: {
      notIn: passedCustomerIds, // Exclude only passed customers, keep liked ones
    },
  };

  // Apply filters
  // Automatic rule wins over any caller-supplied `gender` — see utils/gender.
  if (allowedGenders) {
    whereClause.gender = { in: allowedGenders };
  } else if (gender) {
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

  // Fetch ALL matching customers (for distance filtering + shuffle)
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
          modelId: modelId,
        },
        select: {
          id: true,
          customerId: true,
          contactType: true,
        },
      },
    },
  });

  // Calculate distance if coordinates provided
  let filteredCustomers = customers;
  if (maxDistance && modelLat && modelLng) {
    filteredCustomers = customers.filter((customer) => {
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

  // Add derived fields (isContact, modelAction, distance)
  const enhancedCustomers = filteredCustomers.map((customer) => {
    const distance =
      modelLat != null &&
      modelLng != null &&
      customer.latitude != null &&
      customer.longitude != null
        ? Number(
            calculateDistance(
              Number(customer.latitude),
              Number(customer.longitude),
              modelLat,
              modelLng
            ).toFixed(2)
          )
        : null;

    return {
      ...customer,
      distance,
      isContact: customer.friend_contacts.length > 0,
      modelAction:
        customer.model_interactions.length > 0
          ? customer.model_interactions[0].action
          : null,
    };
  });

  // Nearest first. This replaced a random shuffle: Discover is meant to
  // surface who is physically close, and a shuffle also made pagination
  // incoherent (a fresh order each request means rows repeat and go missing
  // across pages). Profiles with no location sort last rather than vanishing.
  enhancedCustomers.sort((a, b) => {
    if (a.distance == null && b.distance == null) return 0;
    if (a.distance == null) return 1;
    if (b.distance == null) return -1;
    return a.distance - b.distance;
  });

  // Apply pagination AFTER filtering and sorting
  const totalCount = enhancedCustomers.length;
  const paginatedCustomers = enhancedCustomers.slice(skip, skip + perPage);
  const totalPages = Math.ceil(totalCount / perPage);

  return {
    customers: paginatedCustomers,
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

/**
 * Get set of model IDs that a customer can currently chat with.
 * A customer can chat if they have: active booking, daily chat access today, or direct gift sent.
 */
export async function getChattableModelIds(customerId: string): Promise<Set<string>> {
  const ids = new Set<string>();

  try {
    // Check for unlimited subscription (1week, 1month, 3months — durationDays > 1)
    // 24h package (durationDays === 1) is NOT unlimited.
    const subscription = await prisma.subscription.findFirst({
      where: {
        customerId,
        status: "active",
        endDate: { gte: new Date() },
      },
      select: { plan: { select: { durationDays: true } } },
    });

    const isUnlimited = subscription && (subscription.plan?.durationDays ?? 1) > 1;

    if (isUnlimited) {
      // Unlimited subscribers can chat with any active model — return all model IDs
      const allModels = await prisma.model.findMany({
        where: { status: "active" },
        select: { id: true },
      });
      allModels.forEach((m) => ids.add(m.id));
      return ids;
    }

    // Models with active bookings
    const bookings = await prisma.service_booking.findMany({
      where: { customerId, status: { in: ["pending", "confirmed"] } },
      select: { modelId: true },
    });
    bookings.forEach((b) => b.modelId && ids.add(b.modelId));

    // Models with daily chat access today (Laos timezone)
    try {
      const now = new Date();
      const laosDate = new Date(now.getTime() + 7 * 60 * 60 * 1000);
      const todayStr = laosDate.toISOString().slice(0, 10);

      const dailyAccess = await prisma.daily_chat_access.findMany({
        where: { customerId, date: todayStr },
        select: { modelId: true },
      });
      dailyAccess.forEach((d) => ids.add(d.modelId));
    } catch {
      // table may not exist yet
    }

    // Models who received direct gifts from this customer
    try {
      const directGifts = await prisma.direct_gift.findMany({
        where: { customerId },
        select: { modelId: true },
        distinct: ["modelId"],
      });
      directGifts.forEach((g) => ids.add(g.modelId));
    } catch {
      // table may not exist yet
    }
  } catch (e) {
    console.error("[getChattableModelIds] Error:", e);
  }

  return ids;
}

/**
 * Model-side search: find customers by name or WhatsApp number.
 *
 * Mirror of `searchModels`, in the other direction. Two deliberate choices:
 *
 *  - The opposite-gender rule is NOT applied. Search is "find this specific
 *    person I already know", usually by their number — filtering it by gender
 *    would make a known contact unfindable. Browsing (Discover's tabs) stays
 *    gender-filtered; search does not.
 *  - `whatsapp` is matched but never returned. It's a searchable key, not
 *    something to render in a result row.
 */
export async function searchCustomers(modelId: string, query: string) {
  const model = await prisma.model.findUnique({
    where: { id: modelId },
    select: { latitude: true, longitude: true },
  });

  const orConditions: any[] = [
    { firstName: { contains: query, mode: "insensitive" } },
    { lastName: { contains: query, mode: "insensitive" } },
  ];

  // A numeric-looking query is also matched against the WhatsApp number.
  // `whatsapp` is an Int column, so it has to be an exact numeric match —
  // `contains` is not available on integers.
  const numericQuery = query.replace(/\D/g, "");
  if (numericQuery.length >= 2) {
    const asNumber = Number.parseInt(numericQuery, 10);
    if (Number.isSafeInteger(asNumber)) {
      orConditions.push({ whatsapp: { equals: asNumber } });
    }
  }

  const customers = await prisma.customer.findMany({
    where: {
      status: "active",
      OR: orConditions,
    },
    take: 20,
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      dob: true,
      gender: true,
      profile: true,
      latitude: true,
      longitude: true,
      model_interactions: {
        where: { modelId },
        select: { action: true },
      },
    },
  });

  return customers.map((c) => {
    const distance =
      model?.latitude && model?.longitude && c.latitude && c.longitude
        ? Number(
            calculateDistance(
              model.latitude,
              model.longitude,
              c.latitude,
              c.longitude
            ).toFixed(2)
          )
        : null;

    return {
      id: c.id,
      firstName: c.firstName,
      lastName: c.lastName,
      dob: c.dob,
      gender: c.gender,
      profile: c.profile,
      distance,
      modelAction:
        c.model_interactions.length > 0 ? c.model_interactions[0].action : null,
    };
  });
}
