/**
 * Keeps the Chat nav badge live.
 *
 * Mounted once per layout. It joins the shared chat socket (no extra
 * connection — `useChatSocket` refcounts a singleton) and bumps the badge
 * whenever a `message_notification` arrives for a thread the user isn't
 * currently reading.
 *
 * `serverCount` is the layout loader's value. It's authoritative but cached
 * for 30 s, so we adopt it whenever it changes and let the socket carry the
 * count in between.
 */

import { useEffect } from "react";
import { useLocation } from "react-router";
import { useChatSocket } from "./useChatSocket";
import { useChatUnreadStore } from "~/stores/chat.store";

export function useChatBadge(
  userType: "customer" | "model",
  serverCount: number
) {
  const location = useLocation();
  const { unreadTotal, sync, increment } = useChatUnreadStore();

  // Adopt the server's count whenever a revalidation produces a new one.
  useEffect(() => {
    sync(serverCount);
  }, [serverCount, sync]);

  useChatSocket({
    userType,
    onMessageNotification: ({ conversation_id }) => {
      // Don't badge a thread the user is looking at — ChatThread marks it
      // read on arrival, so the server won't count it either.
      const base = userType === "customer" ? "/customer/chat" : "/model/chat";
      if (location.pathname === `${base}/${conversation_id}`) return;
      increment(conversation_id);
    },
  });

  return unreadTotal;
}
