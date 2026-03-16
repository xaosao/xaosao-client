import { prisma } from "./database.server";
import { createAuditLogs } from "./log.server";

type TrackingAction =
  | "CLICK_CHAT"
  | "VIEW_MODEL_PROFILE"
  | "CLICK_BOOK"
  | "ABANDON_BOOKING";

interface TrackActivityParams {
  customerId: string;
  modelId: string;
  action: TrackingAction;
  page?: string;
}

/**
 * Track subscriber activity - only logs for customers with ACTIVE subscriptions.
 * Skips tracking for non-subscribed or expired customers.
 */
export async function trackSubscriberActivity({
  customerId,
  modelId,
  action,
  page,
}: TrackActivityParams): Promise<void> {
  try {
    // Only track active subscribers
    const subscription = await prisma.subscription.findFirst({
      where: {
        customerId,
        status: "active",
        endDate: { gte: new Date() },
      },
      select: { id: true },
    });

    if (!subscription) return;

    await createAuditLogs({
      action,
      description: `Subscriber ${action} on ${page || "unknown"} page | modelId: ${modelId}`,
      status: "success",
      customer: customerId,
      model: modelId,
    });
  } catch (error) {
    console.error("TRACK_SUBSCRIBER_ACTIVITY_FAILED", error);
  }
}
