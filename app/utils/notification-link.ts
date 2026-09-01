/**
 * Where tapping a notification goes.
 *
 * This is the web counterpart of the app's `navigateFromNotification`, and it
 * has to understand TWO type vocabularies, because two writers share the same
 * `customer_notification` / `model_notification` collections:
 *
 *   - xs_backend (what the mobile app sees): `booking_accepted`, `post_like`,
 *     `chat_message`, `profile_liked`, `topup_approved`, …
 *   - this website's own Prisma helpers: `booking_confirmed`, `post_interest`,
 *     `new_message`, `match_new`, `friend_request`, …
 *
 * A user's list therefore contains a mix, and any router that handles only one
 * set silently dumps half the notifications on the index page. Both are mapped
 * below; the contract for the backend set is
 * xs_backend/docs/notification-frontend-guide.html.
 *
 * `data.screen` from the backend is only a hint — the entity ids are what we
 * actually navigate with, exactly as the guide instructs.
 */

export type NotificationSide = "customer" | "model";

interface RoutableNotification {
  type?: string | null;
  data?: Record<string, any> | null;
}

/** Per-side destinations for the handful of shapes we navigate to. */
const ROUTES = {
  customer: {
    booking: (id: string) => `/customer/book-service/detail/${id}`,
    post: (id: string) => `/customer/posts/${id}`,
    chatList: "/customer/chat",
    chatThread: (id: string) => `/customer/chat/${id}`,
    /** The other party's profile — for a customer that's a model. */
    peer: (id: string) => `/customer/user-profile/${id}`,
    ownProfile: "/customer/profile",
    wallet: "/customer/wallets",
    home: "/customer",
    notifications: "/customer/notifications",
  },
  model: {
    booking: (id: string) => `/model/dating/detail/${id}`,
    post: (id: string) => `/model/posts/${id}`,
    chatList: "/model/chat",
    chatThread: (id: string) => `/model/chat/${id}`,
    /** The other party's profile — for a model that's a customer. */
    peer: (id: string) => `/model/customer-profile/${id}`,
    ownProfile: "/model/profile",
    wallet: "/model/settings?tab=wallet",
    home: "/model",
    notifications: "/model/notifications",
  },
} as const;

/** First non-empty string among the given keys. */
function pick(
  data: Record<string, any> | null | undefined,
  ...keys: string[]
): string | null {
  if (!data) return null;
  for (const key of keys) {
    const value = data[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    // FCM flattens everything to strings, but in-app rows keep real types.
    if (typeof value === "number") return String(value);
  }
  return null;
}

const BOOKING_TYPES = new Set([
  // backend
  "booking_created", "booking_accepted", "booking_rejected",
  "booking_cancelled", "booking_completed", "booking_refunded",
  // website
  "booking_confirmed", "booking_disputed", "booking_checkin_model",
  "booking_checkin_customer", "booking_confirmed_completion",
]);

const POST_TYPES = new Set([
  // backend
  "post_like", "post_comment", "post_comment_reply", "post_gift_received",
  "new_customer_post", "new_model_post",
  // website
  "post_interest", "new_post_match",
]);

const CHAT_TYPES = new Set(["chat_message", "new_message"]);

const WALLET_TYPES = new Set([
  "topup_created", "topup_approved", "topup_rejected",
  "withdraw_approved", "withdraw_rejected", "booking_payout_released",
]);

/** Types that point at another person's profile, and the id fields to try. */
const PEOPLE_TYPES: Record<string, string[]> = {
  profile_viewed: ["viewerId", "customerId", "modelId"],
  profile_liked: ["likerId", "customerId", "modelId"],
  match_new: ["modelId", "customerId"],
  friend_added: ["friendId", "customerId", "modelId"],
  friend_request: ["requesterId", "friendId", "customerId", "modelId"],
  friend_accepted: ["friendId", "customerId", "modelId"],
  gift_received: ["senderId", "customerId", "modelId"],
  gift_reaction: ["senderId", "customerId", "modelId"],
  new_model_registered: ["modelId"],
  new_model_service: ["modelId"],
};

const OWN_PROFILE_TYPES = new Set([
  "account_approved", "account_rejected", "account_banned",
  "account_role_changed", "account_reported",
  "profile_approved", "profile_verified",
]);

export function notificationHref(
  notification: RoutableNotification,
  side: NotificationSide
): string {
  const routes = ROUTES[side];
  const type = (notification.type ?? "").trim();
  const data = notification.data ?? {};

  if (BOOKING_TYPES.has(type)) {
    const id = pick(data, "bookingId", "booking_id", "id");
    return id ? routes.booking(id) : routes.notifications;
  }

  if (POST_TYPES.has(type)) {
    const id = pick(data, "postId", "post_id", "id");
    return id ? routes.post(id) : routes.notifications;
  }

  if (CHAT_TYPES.has(type)) {
    const id = pick(data, "conversationId", "conversation_id");
    return id ? routes.chatThread(id) : routes.chatList;
  }

  if (WALLET_TYPES.has(type)) return routes.wallet;

  if (type in PEOPLE_TYPES) {
    const id = pick(data, ...PEOPLE_TYPES[type]);
    return id ? routes.peer(id) : routes.notifications;
  }

  if (OWN_PROFILE_TYPES.has(type)) return routes.ownProfile;

  if (type === "welcome" || type === "account_deleted") return routes.home;

  // Unknown type — the list is the honest destination. Falling back to a
  // guess based on stray ids would send people to the wrong page.
  return routes.notifications;
}
