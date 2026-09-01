/**
 * Customer chat — one conversation.
 *
 * The loader pulls the thread + first page of history from xs_backend; the
 * action sends messages over REST. `ChatService.sendMessage` broadcasts on the
 * socket itself, so sending through the server (JWT never leaves it) still
 * reaches the recipient in realtime.
 */

import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { useLoaderData, redirect } from "react-router";
import { requireVerifiedUserSession } from "~/services/auths.server";
import {
  getConversation,
  getMessages,
  sendMessage,
  XsApiError,
} from "~/services/xs-chat.server";
import { ChatThread } from "~/components/chat/ChatThread";

export async function loader({ request, params }: LoaderFunctionArgs) {
  const customerId = await requireVerifiedUserSession(request);
  const conversationId = params.conversationId!;
  const viewer = { userId: customerId, userType: "customer" as const };

  try {
    const [conversation, history] = await Promise.all([
      getConversation(viewer, conversationId),
      getMessages(viewer, conversationId, { limit: 40 }),
    ]);

    return {
      conversation,
      messages: history.messages,
      hasMore: history.hasMore,
      myUserId: customerId,
    };
  } catch (error) {
    // 403/404 means it isn't ours (or no longer exists) — back to the list
    // rather than an error boundary.
    if (error instanceof XsApiError && [403, 404].includes(error.status)) {
      throw redirect("/customer/chat");
    }
    throw error;
  }
}

/**
 * The thread is driven by the socket, not by loader refetches.
 *
 * React Router revalidates every loader after any fetcher submission, and this
 * screen fires one on each incoming message (marking it read). Without this,
 * every message the peer sent would refetch the whole 40-message page and
 * clobber local state mid-scroll. Only reload when we've actually moved to a
 * different conversation.
 */
export function shouldRevalidate({
  currentParams,
  nextParams,
}: {
  currentParams: Record<string, string | undefined>;
  nextParams: Record<string, string | undefined>;
}): boolean {
  return currentParams.conversationId !== nextParams.conversationId;
}

export async function action({ request, params }: ActionFunctionArgs) {
  const customerId = await requireVerifiedUserSession(request);
  const conversationId = params.conversationId!;

  const formData = await request.formData();
  const content = (formData.get("content") as string | null)?.trim() || "";
  const fileEntry = formData.get("file");
  const file = fileEntry instanceof File && fileEntry.size > 0 ? fileEntry : null;

  if (!content && !file) {
    return { error: "Message is empty" };
  }

  try {
    const message = await sendMessage(
      { userId: customerId, userType: "customer" },
      conversationId,
      { content, file }
    );
    return { message };
  } catch (error) {
    // Surface the backend's own copy — "Your subscription has expired.
    // Please renew to continue chatting." is exactly what the user needs.
    const message =
      error instanceof XsApiError
        ? error.message
        : "Failed to send message. Please try again.";
    console.error("[customer/chat] send failed:", message);
    return { error: message };
  }
}

export default function CustomerChatThread() {
  const { conversation, messages, hasMore, myUserId } =
    useLoaderData<typeof loader>();

  return (
    <ChatThread
      conversation={conversation}
      initialMessages={messages}
      hasMore={hasMore}
      userType="customer"
      myUserId={myUserId}
      basePath="/customer/chat"
      peerProfileHref={
        conversation.peerId
          ? `/customer/user-profile/${conversation.peerId}`
          : undefined
      }
    />
  );
}
