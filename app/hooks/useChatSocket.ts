/**
 * Browser side of the xs_backend chat gateway (socket.io namespace `/chat`).
 *
 * Receive-only by design: sends go through React Router actions → REST, and
 * `ChatService.sendMessage` broadcasts to the socket itself, so a REST send
 * still lands on the recipient in realtime. That keeps message writes on the
 * server (where the JWT lives) while the socket handles the inbound half —
 * new messages, typing indicators, read receipts, deletions.
 *
 * The connection is a REFCOUNTED SINGLETON per userType, mirroring the SSE
 * pattern in `useNotifications`. Three places subscribe at once — the layout
 * (nav badge), the conversation list, and an open thread — and they must share
 * one socket: multiple connections would each receive `message_notification`
 * and double-count the badge, besides being wasteful.
 *
 * The wire contract lives in xs_backend/docs/chat-socket-frontend-guide.html.
 */

import { useEffect, useRef, useState, useCallback } from "react";
import { io, type Socket } from "socket.io-client";

export interface SocketMessage {
  id: string;
  conversationId: string;
  sender: string;
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
}

type Handlers = {
  onNewMessage?: (message: SocketMessage, conversationId: string) => void;
  onMessageNotification?: (payload: {
    conversation_id: string;
    message: SocketMessage;
    sender: { id: string };
  }) => void;
  onTyping?: (payload: {
    conversation_id: string;
    user_id: string;
    is_typing: boolean;
  }) => void;
  onMessagesRead?: (payload: {
    conversation_id: string;
    reader_id: string;
    last_read_message_id?: string;
  }) => void;
  onMessageDeleted?: (payload: {
    conversation_id: string;
    message_id: string;
    deleted_by: string;
  }) => void;
  onStatusChange?: (connected: boolean, userId: string | null) => void;
  /**
   * A notification was created for this user by xs_backend (any type).
   * Rides the chat socket because it's already open and already joined to the
   * user's personal room — see NotificationService.send().
   */
  onNotification?: (payload: {
    notification: {
      id: string;
      type: string;
      title: string;
      message: string;
      la_title?: string;
      la_message?: string;
      data?: Record<string, any> | null;
      is_read?: boolean;
      created_at?: string;
    };
    userType: "customer" | "model";
  }) => void;
};

interface UseChatSocketOptions extends Handlers {
  userType: "customer" | "model";
  /** Join this conversation room. Pass null outside a thread. */
  conversationId?: string | null;
  enabled?: boolean;
}

interface Connection {
  socket: Socket;
  refCount: number;
  connected: boolean;
  userId: string | null;
  /** Every mounted hook instance, so one socket can fan out to all of them. */
  subscribers: Set<{ current: Handlers }>;
  /** Rooms wanted by mounted threads; re-joined after every reconnect. */
  rooms: Set<string>;
}

const connections = new Map<string, Connection>();

function fanout<K extends keyof Handlers>(
  conn: Connection,
  event: K,
  ...args: Parameters<NonNullable<Handlers[K]>>
) {
  for (const sub of conn.subscribers) {
    const handler = sub.current[event] as any;
    if (handler) {
      try {
        handler(...args);
      } catch (error) {
        console.error(`[chat-socket] handler ${String(event)} threw:`, error);
      }
    }
  }
}

async function openConnection(
  userType: "customer" | "model"
): Promise<Connection | null> {
  let auth: {
    token: string;
    userId: string;
    socketUrl: string;
  };

  try {
    const response = await fetch(`/api/chat/token?userType=${userType}`, {
      credentials: "same-origin",
    });
    if (!response.ok) {
      console.warn("[chat-socket] token request failed:", response.status);
      return null;
    }
    auth = await response.json();
  } catch (error) {
    console.warn("[chat-socket] token request errored:", error);
    return null;
  }

  const socket = io(`${auth.socketUrl}/chat`, {
    auth: { token: auth.token },
    transports: ["websocket", "polling"],
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 10_000,
    withCredentials: true,
  });

  const conn: Connection = {
    socket,
    refCount: 0,
    connected: false,
    userId: null,
    subscribers: new Set(),
    rooms: new Set(),
  };

  // The gateway's own `connected` event is the ready signal — the transport
  // can be up while the JWT check is still running.
  socket.on("connected", ({ userId }: { userId: string }) => {
    conn.connected = true;
    conn.userId = userId;
    // Room membership is wiped server-side on disconnect, so re-join
    // everything the mounted components still want after every reconnect.
    for (const room of conn.rooms) {
      socket.emit("join_conversation", { conversation_id: room });
    }
    fanout(conn, "onStatusChange", true, userId);
  });

  socket.on("disconnect", (reason) => {
    conn.connected = false;
    console.warn("[chat-socket] disconnected:", reason);
    fanout(conn, "onStatusChange", false, conn.userId);
  });

  socket.on("connect_error", (error) => {
    conn.connected = false;
    console.warn("[chat-socket] connect_error:", error.message);
    fanout(conn, "onStatusChange", false, conn.userId);
  });

  socket.on(
    "new_message",
    (p: { conversation_id: string; message: SocketMessage }) =>
      fanout(conn, "onNewMessage", p.message, p.conversation_id)
  );
  socket.on("message_notification", (p: any) =>
    fanout(conn, "onMessageNotification", p)
  );
  socket.on("user_typing", (p: any) => fanout(conn, "onTyping", p));
  socket.on("messages_read", (p: any) => fanout(conn, "onMessagesRead", p));
  socket.on("message_deleted", (p: any) => fanout(conn, "onMessageDeleted", p));
  socket.on("notification:new", (p: any) => fanout(conn, "onNotification", p));

  return conn;
}

export function useChatSocket({
  userType,
  conversationId = null,
  enabled = true,
  ...handlers
}: UseChatSocketOptions) {
  const [isConnected, setIsConnected] = useState(false);
  const [myUserId, setMyUserId] = useState<string | null>(null);

  // Handlers are inline arrows in the route components, so they change
  // identity every render. Keep them in a ref that the shared socket reads,
  // so the connection is never torn down just because a parent re-rendered.
  const handlersRef = useRef<Handlers>(handlers);
  handlersRef.current = {
    ...handlers,
    onStatusChange: (connected, userId) => {
      setIsConnected(connected);
      setMyUserId(userId);
      handlers.onStatusChange?.(connected, userId);
    },
  };

  // ── Subscribe to the shared connection ─────────────────────────────────
  useEffect(() => {
    if (!enabled || typeof window === "undefined") return;

    let active = true;
    let conn: Connection | undefined;

    (async () => {
      conn = connections.get(userType);
      if (!conn) {
        const opened = await openConnection(userType);
        if (!opened) return;
        // Another mount may have won the race while we awaited the token.
        const existing = connections.get(userType);
        if (existing) {
          opened.socket.disconnect();
          conn = existing;
        } else {
          connections.set(userType, opened);
          conn = opened;
        }
      }

      if (!active) return;

      conn.refCount++;
      conn.subscribers.add(handlersRef);

      // Reflect the already-established state for a late subscriber.
      if (conn.connected) {
        setIsConnected(true);
        setMyUserId(conn.userId);
      }
    })();

    return () => {
      active = false;
      const current = connections.get(userType);
      if (!current) return;
      current.subscribers.delete(handlersRef);
      current.refCount--;
      if (current.refCount <= 0) {
        current.socket.removeAllListeners();
        current.socket.disconnect();
        connections.delete(userType);
      }
    };
  }, [enabled, userType]);

  // ── Join / leave the conversation room ─────────────────────────────────
  useEffect(() => {
    if (!enabled || !conversationId || typeof window === "undefined") return;

    let joined = false;
    const join = () => {
      const conn = connections.get(userType);
      if (!conn) return false;
      conn.rooms.add(conversationId);
      if (conn.connected) {
        conn.socket.emit("join_conversation", {
          conversation_id: conversationId,
        });
        return true;
      }
      return false;
    };

    joined = join();
    // The connection may still be opening (token fetch + handshake). Retry
    // briefly rather than silently never joining the room — this was the
    // difference between "realtime works" and "nothing arrives".
    const timer = joined
      ? null
      : setInterval(() => {
          if (join()) clearInterval(timer!);
        }, 500);

    return () => {
      if (timer) clearInterval(timer);
      const conn = connections.get(userType);
      if (!conn) return;
      conn.rooms.delete(conversationId);
      if (conn.connected) {
        conn.socket.emit("leave_conversation", {
          conversation_id: conversationId,
        });
      }
    };
  }, [conversationId, enabled, userType, isConnected]);

  const setTyping = useCallback(
    (isTyping: boolean) => {
      const conn = connections.get(userType);
      if (!conn?.connected || !conversationId) return;
      conn.socket.emit("typing", {
        conversation_id: conversationId,
        is_typing: isTyping,
      });
    },
    [conversationId, userType]
  );

  /**
   * Tell the other side we've seen the thread. Fires the `messages_read`
   * event they need for the "seen" tick — the REST `/read` call resets the
   * unread counter but emits nothing.
   */
  const markRead = useCallback(
    (lastReadMessageId?: string) => {
      const conn = connections.get(userType);
      if (!conn?.connected || !conversationId) return;
      conn.socket.emit("mark_read", {
        conversation_id: conversationId,
        ...(lastReadMessageId
          ? { last_read_message_id: lastReadMessageId }
          : {}),
      });
    },
    [conversationId, userType]
  );

  return { isConnected, myUserId, setTyping, markRead };
}
