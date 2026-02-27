import { prisma } from "./database.server";
import { notifyUser } from "./unified-notification.server";

// ==================== Types ====================

interface CreatePostData {
  authorType: "customer" | "model";
  customerId?: string;
  modelId?: string;
  content: string;
  images?: string[];
  serviceId?: string;
  targetGender?: string;
  targetCount?: number;
  targetAgeMin?: number;
  targetAgeMax?: number;
  preferredDate?: Date;
  preferredTime?: string;
  location?: string;
  hasTip?: boolean;
  expiresInHours?: number; // default 24
}

interface PostFilters {
  serviceId?: string;
  page?: number;
  limit?: number;
}

// ==================== CRUD ====================

/**
 * Create a new post and notify matching users on the other side
 */
export async function createPost(data: CreatePostData) {
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + (data.expiresInHours || 24));

  const post = await prisma.post.create({
    data: {
      authorType: data.authorType,
      customerId: data.customerId || undefined,
      modelId: data.modelId || undefined,
      content: data.content,
      images: data.images || [],
      serviceId: data.serviceId || undefined,
      targetGender: data.targetGender || undefined,
      targetCount: data.targetCount || undefined,
      targetAgeMin: data.targetAgeMin || undefined,
      targetAgeMax: data.targetAgeMax || undefined,
      preferredDate: data.preferredDate || undefined,
      preferredTime: data.preferredTime || undefined,
      location: data.location || undefined,
      hasTip: data.hasTip || false,
      expiresAt,
    },
    include: {
      service: { select: { name: true } },
      customer: { select: { firstName: true, lastName: true } },
      model: { select: { firstName: true, lastName: true } },
    },
  });

  // Send notifications asynchronously (don't block the response)
  if (data.authorType === "customer") {
    notifyMatchingModels(post).catch((err) =>
      console.error("[Post] Failed to notify matching models:", err)
    );
  } else {
    notifyMatchingCustomers(post).catch((err) =>
      console.error("[Post] Failed to notify matching customers:", err)
    );
  }

  return post;
}

/**
 * Get posts feed — shows posts from the OTHER side
 * Customers see model posts, models see customer posts
 */
export async function getPostsFeed(
  viewerType: "customer" | "model",
  viewerId: string,
  filters: PostFilters = {}
) {
  const { serviceId, page = 1, limit = 20 } = filters;
  const skip = (page - 1) * limit;

  // Show posts from the opposite side
  const oppositeType = viewerType === "customer" ? "model" : "customer";

  // Build all conditions in a single AND array for cleaner Prisma queries
  const andConditions: any[] = [
    { authorType: oppositeType },
    { status: "active" },
    { expiresAt: { gt: new Date() } },
  ];

  if (serviceId) {
    andConditions.push({ serviceId });
  }

  const where = { AND: andConditions };

  const [posts, total] = await Promise.all([
    prisma.post.findMany({
      where,
      include: {
        customer: {
          select: { id: true, firstName: true, lastName: true, profile: true, gender: true, dob: true, whatsapp: true },
        },
        model: {
          select: { id: true, firstName: true, lastName: true, profile: true, gender: true, dob: true, whatsapp: true },
        },
        service: { select: { id: true, name: true } },
        interests: {
          where: viewerType === "customer"
            ? { customerId: viewerId }
            : { modelId: viewerId },
          select: { id: true },
        },
      },
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    }),
    prisma.post.count({ where }),
  ]);

  // Add `isInterested` flag for the viewer
  const postsWithInterest = posts.map((post) => ({
    ...post,
    isInterested: post.interests.length > 0,
    author: post.authorType === "customer" ? post.customer : post.model,
  }));

  return {
    posts: postsWithInterest,
    total,
    page,
    totalPages: Math.ceil(total / limit),
  };
}

/**
 * Get posts created by the user (for "My Posts" tab)
 */
export async function getMyPosts(
  userId: string,
  userType: "customer" | "model",
  page: number = 1,
  limit: number = 20
) {
  const skip = (page - 1) * limit;

  const where: any = {
    authorType: userType,
    status: { not: "deleted" },
  };
  if (userType === "customer") {
    where.customerId = userId;
  } else {
    where.modelId = userId;
  }

  const [posts, total] = await Promise.all([
    prisma.post.findMany({
      where,
      include: {
        service: { select: { id: true, name: true } },
        _count: { select: { interests: true } },
      },
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    }),
    prisma.post.count({ where }),
  ]);

  return {
    posts,
    total,
    page,
    totalPages: Math.ceil(total / limit),
  };
}

/**
 * Get user's active posts for their profile page (public, visible to everyone)
 */
export async function getUserProfilePosts(
  userId: string,
  userType: "customer" | "model",
  limit: number = 5
) {
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const where: any = {
    authorType: userType,
    status: { in: ["active", "fulfilled"] },
    createdAt: { gte: sevenDaysAgo },
  };
  if (userType === "customer") {
    where.customerId = userId;
  } else {
    where.modelId = userId;
  }

  return prisma.post.findMany({
    where,
    include: {
      service: { select: { id: true, name: true } },
      _count: { select: { interests: true } },
    },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}

/**
 * Get a single post with full details
 */
export async function getPostById(postId: string) {
  return prisma.post.findUnique({
    where: { id: postId },
    include: {
      customer: {
        select: { id: true, firstName: true, lastName: true, profile: true, gender: true, dob: true, whatsapp: true },
      },
      model: {
        select: { id: true, firstName: true, lastName: true, profile: true, gender: true, dob: true, whatsapp: true },
      },
      service: { select: { id: true, name: true } },
      interests: {
        include: {
          customer: {
            select: { id: true, firstName: true, lastName: true, profile: true, whatsapp: true },
          },
          model: {
            select: { id: true, firstName: true, lastName: true, profile: true, whatsapp: true },
          },
        },
        orderBy: { createdAt: "desc" },
      },
    },
  });
}

/**
 * Toggle interest on a post — returns true if now interested, false if removed
 */
export async function toggleInterest(
  postId: string,
  userId: string,
  userType: "customer" | "model"
): Promise<boolean> {
  const existingWhere: any = { postId };
  const createData: any = { postId, userType };

  if (userType === "customer") {
    existingWhere.customerId = userId;
    createData.customerId = userId;
  } else {
    existingWhere.modelId = userId;
    createData.modelId = userId;
  }

  // Check if already interested
  const existing = await prisma.post_interest.findFirst({
    where: existingWhere,
  });

  if (existing) {
    // Remove interest
    await prisma.$transaction([
      prisma.post_interest.delete({ where: { id: existing.id } }),
      prisma.post.update({
        where: { id: postId },
        data: { interestedCount: { decrement: 1 } },
      }),
    ]);
    return false;
  }

  // Add interest
  await prisma.$transaction([
    prisma.post_interest.create({ data: createData }),
    prisma.post.update({
      where: { id: postId },
      data: { interestedCount: { increment: 1 } },
    }),
  ]);

  // Notify the post author
  const post = await prisma.post.findUnique({
    where: { id: postId },
    select: { authorType: true, customerId: true, modelId: true, content: true },
  });

  if (post) {
    const interestedUser = userType === "customer"
      ? await prisma.customer.findUnique({
          where: { id: userId },
          select: { firstName: true, lastName: true },
        })
      : await prisma.model.findUnique({
          where: { id: userId },
          select: { firstName: true, lastName: true },
        });

    const userName = interestedUser
      ? `${interestedUser.firstName} ${interestedUser.lastName || ""}`.trim()
      : "Someone";

    const authorUserId = post.authorType === "customer" ? post.customerId! : post.modelId!;
    const contentPreview = post.content.length > 50
      ? post.content.substring(0, 50) + "..."
      : post.content;

    notifyUser({
      userType: post.authorType as "customer" | "model",
      userId: authorUserId,
      notificationType: "post_interest",
      title: "ມີຄົນສົນໃຈໂພສຂອງທ່ານ!",
      message: `${userName} ສົນໃຈໂພສ: "${contentPreview}"`,
      smsMessage: `XaoSao: ${userName} ສົນໃຈໂພສຂອງທ່ານ. ເປີດແອັບເພື່ອເບິ່ງ.`,
      data: { postId, interestedUserId: userId, interestedUserType: userType },
      url: `/${post.authorType}/posts/${postId}`,
    }).catch((err) =>
      console.error("[Post] Failed to notify interest:", err)
    );
  }

  return true;
}

/**
 * Soft-delete own post
 */
export async function deletePost(postId: string, userId: string, userType: "customer" | "model") {
  const where: any = { id: postId, authorType: userType };
  if (userType === "customer") where.customerId = userId;
  else where.modelId = userId;

  const post = await prisma.post.findFirst({ where });
  if (!post) throw new Error("Post not found or unauthorized");

  return prisma.post.update({
    where: { id: postId },
    data: { status: "deleted" },
  });
}

/**
 * Mark post as fulfilled
 */
export async function markPostFulfilled(postId: string, userId: string, userType: "customer" | "model") {
  const where: any = { id: postId, authorType: userType, status: "active" };
  if (userType === "customer") where.customerId = userId;
  else where.modelId = userId;

  const post = await prisma.post.findFirst({ where });
  if (!post) throw new Error("Post not found or unauthorized");

  return prisma.post.update({
    where: { id: postId },
    data: { status: "fulfilled" },
  });
}

/**
 * Expire old posts — called by cron job
 */
export async function expireOldPosts() {
  const result = await prisma.post.updateMany({
    where: {
      status: "active",
      expiresAt: { lte: new Date() },
    },
    data: { status: "expired" },
  });
  if (result.count > 0) {
    console.log(`[Post Cron] Expired ${result.count} posts`);
  }
  return result.count;
}

// ==================== Matching & Notifications ====================

/**
 * Find and notify models matching a customer's post
 */
async function notifyMatchingModels(post: any) {
  const BATCH_SIZE = 50;
  const BATCH_DELAY_MS = 500;

  // Build model query based on post criteria
  const modelWhere: any = {
    status: "active",
  };

  // Filter by gender if specified
  if (post.targetGender) {
    modelWhere.gender = post.targetGender;
  }

  // Filter by age range if specified
  if (post.targetAgeMin || post.targetAgeMax) {
    const dobFilter: any = {};
    if (post.targetAgeMax) {
      // Max age = born at least this many years ago
      const minDob = new Date();
      minDob.setFullYear(minDob.getFullYear() - post.targetAgeMax - 1);
      dobFilter.gte = minDob;
    }
    if (post.targetAgeMin) {
      // Min age = born at most this many years ago
      const maxDob = new Date();
      maxDob.setFullYear(maxDob.getFullYear() - post.targetAgeMin);
      dobFilter.lte = maxDob;
    }
    modelWhere.dob = dobFilter;
  }

  // If a service is specified, only notify models who offer it
  let modelIds: string[] | null = null;
  if (post.serviceId) {
    const modelServices = await prisma.model_service.findMany({
      where: {
        serviceId: post.serviceId,
        status: { not: "deleted" },
        isAvailable: true,
      },
      select: { modelId: true },
    });
    modelIds = modelServices.map((ms) => ms.modelId).filter((id): id is string => id !== null);
    if (modelIds.length === 0) return; // No models offer this service
    modelWhere.id = { in: modelIds };
  }

  const models = await prisma.model.findMany({
    where: modelWhere,
    select: { id: true, firstName: true },
  });

  if (models.length === 0) return;

  const customerName = post.customer
    ? `${post.customer.firstName} ${post.customer.lastName || ""}`.trim()
    : "Customer";
  const serviceNameMap: Record<string, string> = {
    drinkingFriend: "ເພື່ອນດື່ມ",
    travelingFriend: "ເພື່ອນທ່ອງທ່ຽວ",
    sleepPartner: "ຄູ່ນອນ",
    massage: "ບໍລິການນວດ",
    hmongNewYear: "ຄູ່ປີໃໝ່ມົ້ງ",
  };
  const serviceName = serviceNameMap[post.service?.name] || post.service?.name || "";
  const contentPreview = post.content.length > 80
    ? post.content.substring(0, 80) + "..."
    : post.content;

  const notifiedIds: string[] = [];

  // Send in batches
  for (let i = 0; i < models.length; i += BATCH_SIZE) {
    const batch = models.slice(i, i + BATCH_SIZE);

    const tipTag = post.hasTip ? " (ມີທິບເພີ່ມ)" : "";
    await Promise.allSettled(
      batch.map((model) =>
        notifyUser({
          userType: "model",
          userId: model.id,
          notificationType: "new_post_match",
          title: `ມີການຮ້ອງຂໍໃໝ່!${tipTag}`,
          message: `${customerName}: "${contentPreview}"${tipTag}`,
          smsMessage: `XaoSao: ${customerName} ກຳລັງຊອກຫາ${serviceName ? ` ${serviceName}` : "ບໍລິການ"}${tipTag}.\nເຂົ້າເບິ່ງລາຍລະອຽດໃນແອັບ xaosao.`,
          data: { postId: post.id, customerId: post.customerId },
          url: `/model/posts/${post.id}`,
        })
      )
    );

    notifiedIds.push(...batch.map((m) => m.id));

    if (i + BATCH_SIZE < models.length) {
      await new Promise((resolve) => setTimeout(resolve, BATCH_DELAY_MS));
    }
  }

  // Track notified user IDs
  await prisma.post.update({
    where: { id: post.id },
    data: {
      notifiedUserIds: { push: notifiedIds },
    },
  });
}

/**
 * Find and notify subscribed customers matching a model's post
 */
async function notifyMatchingCustomers(post: any) {
  const BATCH_SIZE = 50;
  const BATCH_DELAY_MS = 500;

  // Find customers with active subscriptions
  const activeSubscriptions = await prisma.subscription.findMany({
    where: {
      status: "active",
      endDate: { gte: new Date() },
    },
    select: { customerId: true },
    distinct: ["customerId"],
  });

  const subscribedCustomerIds = activeSubscriptions.map((s) => s.customerId);
  if (subscribedCustomerIds.length === 0) return;

  const customers = await prisma.customer.findMany({
    where: {
      id: { in: subscribedCustomerIds },
      status: "active",
    },
    select: { id: true, firstName: true },
  });

  if (customers.length === 0) return;

  const modelName = post.model
    ? `${post.model.firstName} ${post.model.lastName || ""}`.trim()
    : "Model";
  const serviceNameMap: Record<string, string> = {
    drinkingFriend: "ເພື່ອນດື່ມ",
    travelingFriend: "ເພື່ອນທ່ອງທ່ຽວ",
    sleepPartner: "ຄູ່ນອນ",
    massage: "ບໍລິການນວດ",
    hmongNewYear: "ຄູ່ປີໃໝ່ມົ້ງ",
  };
  const serviceName = serviceNameMap[post.service?.name] || post.service?.name || "";
  const contentPreview = post.content.length > 80
    ? post.content.substring(0, 80) + "..."
    : post.content;

  const notifiedIds: string[] = [];

  // Send in batches
  for (let i = 0; i < customers.length; i += BATCH_SIZE) {
    const batch = customers.slice(i, i + BATCH_SIZE);

    await Promise.allSettled(
      batch.map((customer) =>
        notifyUser({
          userType: "customer",
          userId: customer.id,
          notificationType: "new_post_match",
          title: "ມີໂພສໃໝ່!",
          message: `${modelName}: "${contentPreview}"`,
          smsMessage: `Xaosao: ${modelName} ເປີດໃຫ້ບໍລິການ${serviceName ? ` ${serviceName}` : ""} ແລ້ວ.\nເບິ່ງລາຍລະອຽດ: https://xaosao.com/customer/user-profile/${post.modelId}`,
          data: { postId: post.id, modelId: post.modelId },
          url: `/customer/posts/${post.id}`,
        })
      )
    );

    notifiedIds.push(...batch.map((c) => c.id));

    if (i + BATCH_SIZE < customers.length) {
      await new Promise((resolve) => setTimeout(resolve, BATCH_DELAY_MS));
    }
  }

  // Track notified user IDs
  await prisma.post.update({
    where: { id: post.id },
    data: {
      notifiedUserIds: { push: notifiedIds },
    },
  });
}

// ==================== Helpers ====================

function calculateAge(dob: Date): number {
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const monthDiff = today.getMonth() - dob.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
    age--;
  }
  return age;
}

/**
 * Get available services for the post creation form
 */
export async function getActiveServices() {
  return prisma.service.findMany({
    where: { status: "active" },
    select: { id: true, name: true },
    orderBy: { order: "asc" },
  });
}

/**
 * Get services offered by a specific model (for model's create post form)
 */
export async function getModelActiveServices(modelId: string) {
  const modelServices = await prisma.model_service.findMany({
    where: {
      modelId,
      status: { not: "deleted" },
      isAvailable: true,
    },
    select: {
      service: {
        select: { id: true, name: true },
      },
    },
  });
  return modelServices.map((ms) => ms.service).filter(Boolean);
}

/**
 * Get model's basic profile info (for create post form header)
 */
export async function getModelBasicProfile(modelId: string) {
  return prisma.model.findUnique({
    where: { id: modelId },
    select: { id: true, firstName: true, lastName: true, profile: true },
  });
}

/**
 * Get customer's basic profile info (for my posts header)
 */
export async function getCustomerBasicProfile(customerId: string) {
  return prisma.customer.findUnique({
    where: { id: customerId },
    select: { id: true, firstName: true, lastName: true, profile: true },
  });
}

/**
 * Get a post for public sharing (no auth required) — minimal data for OG meta tags
 */
export async function getPostForShare(postId: string) {
  return prisma.post.findUnique({
    where: { id: postId },
    select: {
      id: true,
      content: true,
      images: true,
      authorType: true,
      status: true,
      createdAt: true,
      service: { select: { name: true } },
      customer: { select: { firstName: true, lastName: true, profile: true } },
      model: { select: { firstName: true, lastName: true, profile: true } },
    },
  });
}
