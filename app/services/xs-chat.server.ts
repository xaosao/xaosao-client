/**
 * Chat, backed by the xs_backend API (`/api/v1/chat/*`).
 *
 * This is the same API the mobile app uses, so web and app now render the
 * identical conversation list, message history, read state and unread counts.
 * The website's own Prisma helpers in `chat.server.ts` read the same
 * collections but bypass the backend's participant checks, subscription gate
 * and realtime fan-out, so all chat reads/writes go through here instead.
 *
 * Writes go over REST (not the socket) on purpose: `ChatService.sendMessage`
 * calls `ChatGateway.broadcastNewMessage()` itself, so a REST send still
 * reaches the recipient in realtime — and doing it server-side keeps the JWT
 * out of the browser.
 */

import { unwrapEnvelope, xsRequest, XsApiError } from "./xs-api.server";
import type { XsUserType } from "./xs-jwt.server";
import { parseXsDate } from "~/utils/xs-date";

export { XsApiError };

export interface XsChatParticipant {
  id: string;
  firstName: string | null;
  lastName: string | null;
  profile: string | null;
  isOnline: boolean;
}

export interface XsConversation {
  id: string;
  customerId: string | null;
  modelId: string | null;
  bookingId: string | null;
  status: string;
  blockedByCustomer: boolean;
  blockedByModel: boolean;
  lastMessage: string | null;
  lastMessageText: string | null;
  lastMessageType: string | null;
  lastMessageMediaUrl: string | null;
  lastMessageSenderId: string | null;
  customerUnreadCount: number;
  modelUnreadCount: number;
  customerPinned: boolean;
  modelPinned: boolean;
  customerNotifications: boolean;
  modelNotifications: boolean;
  createdAt: string | null;
  updatedAt: string | null;
  customer: XsChatParticipant | null;
  model: XsChatParticipant | null;
}

export interface XsMessage {
  id: string;
  conversationId: string | null;
  sender: string | null;
  senderType: "customer" | "model";
  messageText: string | null;
  messageType: string;
  fileUrl: string | null;
  fileName: string | null;
  fileSize: string | null;
  isRead: boolean;
  isDeleted: boolean;
  replyToMessageId: string | null;
  sendAt: string | null;
  readAt: string | null;
  editedAt: string | null;
  createdAt: string | null;
  metadata: Record<string, any> | null;
  reactions: Array<{
    id: string;
    userId: string;
    reaction: string;
    createdAt: string | null;
  }>;
}

/**
 * A conversation flattened for rendering: the *other* participant is resolved
 * and the viewer's own unread count / pin flag are lifted to the top level, so
 * a single component works for both the customer and the model side.
 */
export interface XsConversationView {
  id: string;
  peer: XsChatParticipant;
  peerId: string;
  status: string;
  isBlocked: boolean;
  blockedByMe: boolean;
  unreadCount: number;
  pinned: boolean;
  lastMessageText: string | null;
  lastMessageType: string | null;
  lastMessageMediaUrl: string | null;
  /** True when the last message in the thread was sent by the viewer. */
  lastMessageFromMe: boolean;
  /** ISO string, or null when the thread has no messages yet. */
  lastMessageAt: string | null;
}

const EMPTY_PEER: XsChatParticipant = {
  id: "",
  firstName: null,
  lastName: null,
  profile: null,
  isOnline: false,
};

/**
 * Collapse a raw conversation into the viewer's perspective.
 * `viewerType` decides which side of the row is "me".
 */
export function toConversationView(
  conversation: XsConversation,
  viewerType: XsUserType
): XsConversationView {
  const isCustomer = viewerType === "customer";
  const peer = (isCustomer ? conversation.model : conversation.customer) ?? {
    ...EMPTY_PEER,
    id: (isCustomer ? conversation.modelId : conversation.customerId) ?? "",
  };
  const viewerId = isCustomer ? conversation.customerId : conversation.modelId;

  return {
    id: conversation.id,
    peer,
    peerId: peer.id,
    status: conversation.status,
    isBlocked:
      conversation.status === "blocked" ||
      conversation.blockedByCustomer ||
      conversation.blockedByModel,
    blockedByMe: isCustomer
      ? conversation.blockedByCustomer
      : conversation.blockedByModel,
    unreadCount: isCustomer
      ? conversation.customerUnreadCount ?? 0
      : conversation.modelUnreadCount ?? 0,
    pinned: isCustomer ? conversation.customerPinned : conversation.modelPinned,
    lastMessageText: conversation.lastMessageText,
    lastMessageType: conversation.lastMessageType,
    lastMessageMediaUrl: conversation.lastMessageMediaUrl,
    lastMessageFromMe:
      !!conversation.lastMessageSenderId &&
      conversation.lastMessageSenderId === viewerId,
    lastMessageAt: parseXsDate(conversation.lastMessage)?.toISOString() ?? null,
  };
}

interface Viewer {
  userId: string;
  userType: XsUserType;
}

/**
 * Guard every id before it goes into a request path.
 *
 * A missing id used to be interpolated straight into the URL as the literal
 * string "undefined", which reached the backend and blew up inside
 * `new ObjectId()` as an opaque 500. Failing here instead turns that into a
 * clear, attributable error on our side of the wire.
 */
function assertObjectId(id: string | undefined | null, label: string): string {
  if (!id || !/^[a-fA-F0-9]{24}$/.test(id)) {
    throw new XsApiError(
      400,
      `Invalid ${label}: ${JSON.stringify(id)}`,
      "INVALID_ID"
    );
  }
  return id;
}

/** GET /chat/conversations */
export async function listConversations(
  viewer: Viewer,
  options: { page?: number; limit?: number; search?: string } = {}
): Promise<{ conversations: XsConversationView[]; total: number; totalPages: number }> {
  const response = await xsRequest<any>("chat/conversations", {
    ...viewer,
    query: {
      page: options.page ?? 1,
      limit: options.limit ?? 30,
      search: options.search,
    },
  });

  // The deployed backend runs a global transform interceptor that rewrites
  // controller returns into the paginated envelope — `data` holds the array
  // and the counts sit at the TOP level, not under `pagination`. Read both
  // shapes so this works with or without the interceptor.
  const rows: XsConversation[] = unwrapEnvelope<XsConversation[]>(response) ?? [];

  return {
    conversations: rows.map((c) => toConversationView(c, viewer.userType)),
    total: response.total ?? response.pagination?.total ?? rows.length,
    totalPages: response.totalPages ?? response.pagination?.totalPages ?? 1,
  };
}

/** GET /chat/conversations/:id */
export async function getConversation(
  viewer: Viewer,
  conversationId: string
): Promise<XsConversationView> {
  const response = await xsRequest<any>(
    `chat/conversations/${assertObjectId(conversationId, "conversation id")}`,
    viewer
  );
  return toConversationView(
    unwrapEnvelope<XsConversation>(response),
    viewer.userType
  );
}

/**
 * GET /chat/conversations/:id/messages
 *
 * The backend returns newest-first; the UI renders oldest-at-top, so the page
 * is reversed here and callers can just append/prepend.
 */
export async function getMessages(
  viewer: Viewer,
  conversationId: string,
  options: { page?: number; limit?: number; before?: string } = {}
): Promise<{ messages: XsMessage[]; hasMore: boolean; page: number }> {
  const page = options.page ?? 1;
  const limit = options.limit ?? 40;
  const response = await xsRequest<any>(
    `chat/conversations/${assertObjectId(conversationId, "conversation id")}/messages`,
    { ...viewer, query: { page, limit, before: options.before } }
  );

  const rows: XsMessage[] = unwrapEnvelope<XsMessage[]>(response) ?? [];

  // The controller sets `has_more`, but the global transform interceptor
  // drops any key outside the envelope — so derive it from the paging
  // counts instead, falling back to `has_more` when it does survive.
  const total = response.total ?? response.pagination?.total;
  const hasMore =
    typeof response.has_more === "boolean"
      ? response.has_more
      : typeof total === "number"
        ? page * limit < total
        : rows.length === limit;

  return { messages: [...rows].reverse(), hasMore, page };
}

/**
 * POST /chat/conversations — start a thread with `recipientId`, or return the
 * existing one. Idempotent on the backend.
 */
export async function startConversation(
  viewer: Viewer,
  recipientId: string,
  options: { bookingId?: string; initialMessage?: string } = {}
): Promise<XsConversationView> {
  const response = await xsRequest<any>("chat/conversations", {
    ...viewer,
    method: "POST",
    body: {
      recipientId,
      ...(options.bookingId ? { bookingId: options.bookingId } : {}),
      ...(options.initialMessage
        ? { initialMessage: options.initialMessage }
        : {}),
    },
  });
  return toConversationView(
    unwrapEnvelope<XsConversation>(response),
    viewer.userType
  );
}

/** POST /chat/conversations/:id/messages — text, or an image with caption. */
export async function sendMessage(
  viewer: Viewer,
  conversationId: string,
  input: { content?: string; replyToId?: string; file?: File | null }
): Promise<XsMessage> {
  const hasFile = !!input.file && input.file.size > 0;

  // The endpoint is always multipart (FileInterceptor), and multer is happy
  // with a file-less multipart body, so one code path covers both cases.
  const form = new FormData();
  form.set("type", hasFile ? "image" : "text");
  if (input.content) form.set("content", input.content);
  if (input.replyToId) form.set("replyToId", input.replyToId);
  if (hasFile) form.set("file", input.file as File);

  const response = await xsRequest<any>(
    `chat/conversations/${assertObjectId(conversationId, "conversation id")}/messages`,
    { ...viewer, method: "POST", formData: form }
  );
  return unwrapEnvelope<XsMessage>(response);
}

/** POST /chat/conversations/:id/read */
export async function markConversationRead(
  viewer: Viewer,
  conversationId: string,
  lastReadMessageId?: string
): Promise<void> {
  await xsRequest(`chat/conversations/${assertObjectId(conversationId, "conversation id")}/read`, {
    ...viewer,
    method: "POST",
    body: lastReadMessageId
      ? { last_read_message_id: lastReadMessageId }
      : {},
  });
}

/** DELETE /chat/messages/:id — per-side soft delete. */
export async function deleteMessage(
  viewer: Viewer,
  messageId: string
): Promise<void> {
  await xsRequest(`chat/messages/${assertObjectId(messageId, "message id")}`, {
    ...viewer,
    method: "DELETE",
  });
}

/** DELETE /chat/conversations/:id — hides the thread for the caller only. */
export async function deleteConversation(
  viewer: Viewer,
  conversationId: string
): Promise<void> {
  await xsRequest(`chat/conversations/${assertObjectId(conversationId, "conversation id")}`, {
    ...viewer,
    method: "DELETE",
  });
}

/** POST /chat/conversations/:id/{pin,unpin} */
export async function setConversationPinned(
  viewer: Viewer,
  conversationId: string,
  pinned: boolean
): Promise<void> {
  await xsRequest(
    `chat/conversations/${conversationId}/${pinned ? "pin" : "unpin"}`,
    { ...viewer, method: "POST" }
  );
}

/** POST /chat/conversations/:id/{block,unblock} */
export async function setConversationBlocked(
  viewer: Viewer,
  conversationId: string,
  blocked: boolean
): Promise<void> {
  await xsRequest(
    `chat/conversations/${conversationId}/${blocked ? "block" : "unblock"}`,
    { ...viewer, method: "POST" }
  );
}

/**
 * How many CONVERSATIONS have unread messages — the number on the Chat nav
 * badge.
 *
 * Deliberately different from the per-row badges, which show unread *messages*
 * in that thread. The backend's `/chat/unread-count` sums messages across all
 * threads, so it can't answer this; we count rows with `unreadCount > 0`
 * instead. "3" on the nav means three people are waiting, not three messages.
 *
 * Never throws: a chat outage must not take down the layout, so failures
 * degrade to 0.
 */
export async function getChatUnreadCount(viewer: Viewer): Promise<number> {
  try {
    const response = await xsRequest<any>("chat/conversations", {
      ...viewer,
      timeoutMs: 6_000,
      // Generous enough that the badge is right for any realistic inbox; it
      // renders as "99+" long before this becomes the limiting factor.
      query: { page: 1, limit: 50 },
    });

    const rows: XsConversation[] = unwrapEnvelope<XsConversation[]>(response) ?? [];
    const isCustomer = viewer.userType === "customer";

    return rows.filter((conversation) => {
      const unread = isCustomer
        ? conversation.customerUnreadCount ?? 0
        : conversation.modelUnreadCount ?? 0;
      return unread > 0;
    }).length;
  } catch (error) {
    console.error("[xs-chat] unread conversations failed:", (error as Error)?.message);
    return 0;
  }
}
