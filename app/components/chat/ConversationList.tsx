/**
 * Conversation list — shared by the customer and model chat screens.
 *
 * The server hands over conversations already flattened to the viewer's
 * perspective (`XsConversationView`), so this component doesn't care which
 * side it's rendering for; `basePath` is the only difference.
 *
 * Realtime: a `message_notification` from the socket bumps the matching row's
 * preview + unread badge and re-sorts, so the list stays live without polling.
 */

import { useMemo, useState, useEffect } from "react";
import { Link, useRevalidator } from "react-router";
import { useTranslation } from "react-i18next";
import { MessageCircle, Search, ImageIcon, Pin, Ban } from "lucide-react";
import type { XsConversationView } from "~/services/xs-chat.server";
import { useChatSocket } from "~/hooks/useChatSocket";

interface ConversationListProps {
  conversations: XsConversationView[];
  userType: "customer" | "model";
  /** e.g. "/customer/chat" — rows link to `${basePath}/${conversationId}`. */
  basePath: string;
}

/** "3m", "5h", "2d", then a date. Kept terse — the row is narrow. */
function formatTimestamp(iso: string | null, locale: string): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";

  const minutes = Math.floor((Date.now() - date.getTime()) / 60_000);
  if (minutes < 1) return "now";
  if (minutes < 60) return `${minutes}m`;
  if (minutes < 60 * 24) return `${Math.floor(minutes / 60)}h`;
  if (minutes < 60 * 24 * 7) return `${Math.floor(minutes / (60 * 24))}d`;
  return date.toLocaleDateString(locale, { day: "numeric", month: "short" });
}

function displayName(conversation: XsConversationView): string {
  const { firstName, lastName } = conversation.peer;
  return [firstName, lastName].filter(Boolean).join(" ") || "XaoSao user";
}

export function ConversationList({
  conversations: initialConversations,
  userType,
  basePath,
}: ConversationListProps) {
  const { t, i18n } = useTranslation();
  const revalidator = useRevalidator();
  const [conversations, setConversations] = useState(initialConversations);
  const [search, setSearch] = useState("");

  // Loader data wins whenever the route revalidates.
  useEffect(() => {
    setConversations(initialConversations);
  }, [initialConversations]);

  useChatSocket({
    userType,
    onMessageNotification: ({ conversation_id, message }) => {
      setConversations((current) => {
        const index = current.findIndex((c) => c.id === conversation_id);
        // A brand-new thread isn't in the list yet — refetch rather than
        // inventing a row with no name or avatar.
        if (index === -1) {
          revalidator.revalidate();
          return current;
        }

        const updated = {
          ...current[index],
          lastMessageText: message.messageText,
          lastMessageType: message.messageType,
          lastMessageFromMe: false,
          lastMessageAt: new Date().toISOString(),
          unreadCount: current[index].unreadCount + 1,
        };

        const rest = current.filter((_, i) => i !== index);
        // Pinned threads keep their position at the top of the list.
        const firstUnpinned = rest.findIndex((c) => !c.pinned);
        const insertAt =
          updated.pinned || firstUnpinned === -1 ? 0 : firstUnpinned;
        return [...rest.slice(0, insertAt), updated, ...rest.slice(insertAt)];
      });
    },
  });

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return conversations;
    return conversations.filter((c) =>
      displayName(c).toLowerCase().includes(term)
    );
  }, [conversations, search]);

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 pt-4 pb-3 border-b bg-white sm:sticky sm:top-0 z-10">
        <h1 className="text-xl font-semibold mb-3" suppressHydrationWarning>
          {t("navigation.chat")}
        </h1>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={t("chat.searchPlaceholder", {
              defaultValue: "Search conversations",
            })}
            className="w-full pl-9 pr-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-full focus:outline-none focus:ring-2 focus:ring-rose-200"
            suppressHydrationWarning
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center flex-1 py-20 px-6 text-center">
          <MessageCircle className="w-12 h-12 text-gray-300 mb-3" />
          <p className="text-sm text-gray-500" suppressHydrationWarning>
            {search
              ? t("chat.noResults", { defaultValue: "No conversations found" })
              : t("chat.empty", { defaultValue: "No conversations yet" })}
          </p>
        </div>
      ) : (
        <div className="divide-y">
          {filtered.map((conversation) => (
            <Link
              key={conversation.id}
              to={`${basePath}/${conversation.id}`}
              prefetch="intent"
              className="flex items-center gap-3 px-4 py-3 hover:bg-rose-50/60 transition-colors"
            >
              <div className="relative shrink-0">
                {conversation.peer.profile ? (
                  <img
                    src={conversation.peer.profile}
                    alt={displayName(conversation)}
                    className="w-12 h-12 rounded-full object-cover border border-gray-200"
                    loading="lazy"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-rose-100 flex items-center justify-center text-rose-500 font-medium">
                    {displayName(conversation).charAt(0).toUpperCase()}
                  </div>
                )}
                {conversation.peer.isOnline && (
                  <span className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 rounded-full border-2 border-white" />
                )}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <p
                    className={`truncate ${
                      conversation.unreadCount > 0
                        ? "font-semibold text-gray-900"
                        : "font-medium text-gray-700"
                    }`}
                  >
                    {displayName(conversation)}
                  </p>
                  {conversation.pinned && (
                    <Pin className="w-3 h-3 text-gray-400 shrink-0" />
                  )}
                  {conversation.isBlocked && (
                    <Ban className="w-3 h-3 text-gray-400 shrink-0" />
                  )}
                </div>
                <p
                  className={`text-xs truncate mt-0.5 flex items-center gap-1 ${
                    conversation.unreadCount > 0
                      ? "text-gray-700"
                      : "text-gray-500"
                  }`}
                >
                  {conversation.lastMessageFromMe && (
                    <span className="text-gray-400">
                      {t("chat.youPrefix", { defaultValue: "You:" })}
                    </span>
                  )}
                  {conversation.lastMessageType === "image" ? (
                    <>
                      <ImageIcon className="w-3 h-3 shrink-0" />
                      {t("chat.photo", { defaultValue: "Photo" })}
                    </>
                  ) : (
                    conversation.lastMessageText ||
                    t("chat.noMessagesYet", {
                      defaultValue: "No messages yet",
                    })
                  )}
                </p>
              </div>

              <div className="flex flex-col items-end gap-1 shrink-0">
                <span className="text-[10px] text-gray-400">
                  {formatTimestamp(conversation.lastMessageAt, i18n.language)}
                </span>
                {conversation.unreadCount > 0 && (
                  <span className="min-w-[20px] h-5 px-1.5 flex items-center justify-center rounded-full bg-rose-500 text-white text-[11px] font-medium">
                    {conversation.unreadCount > 99
                      ? "99+"
                      : conversation.unreadCount}
                  </span>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
