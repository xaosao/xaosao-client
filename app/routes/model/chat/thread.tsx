/**
 * Model chat — one conversation. See routes/customer/chat/thread.tsx for the
 * data-flow notes; this is the same route with the model session.
 */

import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { useLoaderData, redirect } from "react-router";
import { requireModelSession } from "~/services/model-auth.server";
import {
  getConversation,
  getMessages,
  sendMessage,
  XsApiError,
} from "~/services/xs-chat.server";
import { ChatThread } from "~/components/chat/ChatThread";

export async function loader({ request, params }: LoaderFunctionArgs) {
  const modelId = await requireModelSession(request);
  const conversationId = params.conversationId!;
  const viewer = { userId: modelId, userType: "model" as const };

  try {
    const [conversation, history] = await Promise.all([
      getConversation(viewer, conversationId),
      getMessages(viewer, conversationId, { limit: 40 }),
    ]);

    return {
      conversation,
      messages: history.messages,
      hasMore: history.hasMore,
      myUserId: modelId,
    };
  } catch (error) {
    if (error instanceof XsApiError && [403, 404].includes(error.status)) {
      throw redirect("/model/chat");
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
  const modelId = await requireModelSession(request);
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
      { userId: modelId, userType: "model" },
      conversationId,
      { content, file }
    );
    return { message };
  } catch (error) {
    const message =
      error instanceof XsApiError
        ? error.message
        : "Failed to send message. Please try again.";
    console.error("[model/chat] send failed:", message);
    return { error: message };
  }
}

export default function ModelChatThread() {
  const { conversation, messages, hasMore, myUserId } =
    useLoaderData<typeof loader>();

  return (
    <ChatThread
      conversation={conversation}
      initialMessages={messages}
      hasMore={hasMore}
      userType="model"
      myUserId={myUserId}
      basePath="/model/chat"
      peerProfileHref={
        conversation.peerId
          ? `/model/customer-profile/${conversation.peerId}`
          : undefined
      }
    />
  );
}
