import { create } from "zustand";

/**
 * Live count of CONVERSATIONS with unread messages — the Chat nav badge.
 *
 * Note this counts threads, not messages: "3" means three people are waiting.
 * The per-row badges in the conversation list are the other thing — unread
 * *messages* within that one thread — so the two intentionally differ.
 *
 * The layout loader supplies an authoritative number but sits behind a 30 s
 * cache, so the socket keeps this in step in between: a message in a thread
 * that isn't already counted adds one, and opening a thread removes it.
 * `unreadConversations` is what makes "already counted" answerable — without
 * it, five messages in one thread would read as five waiting people.
 */
interface ChatUnreadState {
  unreadTotal: number;
  /** Ids currently contributing to the badge. */
  unreadConversations: Set<string>;
  /** Adopt the server's number (called whenever the loader value changes). */
  sync: (total: number) => void;
  /** A message arrived in `conversationId` while we weren't reading it. */
  increment: (conversationId: string) => void;
  /** The user opened a thread — drop it from the badge. */
  clearConversation: (conversationId: string) => void;
}

export const useChatUnreadStore = create<ChatUnreadState>((set) => ({
  unreadTotal: 0,
  unreadConversations: new Set<string>(),

  sync: (total) =>
    set({
      unreadTotal: Math.max(0, total),
      // The server count is authoritative again. We can't know WHICH threads
      // it covered, so start tracking afresh; the next message in any thread
      // re-adds it.
      unreadConversations: new Set<string>(),
    }),

  increment: (conversationId) =>
    set((state) => {
      // Already counted — a second message in the same thread must not bump
      // the badge, because the badge counts threads.
      if (state.unreadConversations.has(conversationId)) return state;
      const next = new Set(state.unreadConversations);
      next.add(conversationId);
      return { unreadTotal: state.unreadTotal + 1, unreadConversations: next };
    }),

  clearConversation: (conversationId) =>
    set((state) => {
      const next = new Set(state.unreadConversations);
      next.delete(conversationId);
      // Always decrement: callers only invoke this for a thread that HAD
      // unread messages. The set may not contain the id (a `sync` clears it
      // while the server total still covered this thread), so membership
      // can't gate the decrement.
      return {
        unreadConversations: next,
        unreadTotal: Math.max(0, state.unreadTotal - 1),
      };
    }),
}));
