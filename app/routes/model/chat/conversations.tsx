/**
 * Model chat — conversation list.
 *
 * Mirror of the customer list; the only differences are the session helper
 * and the base path. Models don't need a subscription to reply, so there is
 * no access gate on this side.
 */

import type { LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";
import { requireModelSession } from "~/services/model-auth.server";
import { listConversations } from "~/services/xs-chat.server";
import { ConversationList } from "~/components/chat/ConversationList";

export async function loader({ request }: LoaderFunctionArgs) {
  const modelId = await requireModelSession(request);

  try {
    const { conversations } = await listConversations({
      userId: modelId,
      userType: "model",
    });
    return { conversations, error: null };
  } catch (error) {
    console.error("[model/chat] list failed:", (error as Error)?.message);
    return {
      conversations: [],
      error: (error as Error)?.message ?? "Unable to load conversations",
    };
  }
}

export default function ModelConversations() {
  const { conversations, error } = useLoaderData<typeof loader>();

  return (
    <>
      {error && (
        <p className="px-4 py-2 text-xs text-amber-700 bg-amber-50 border-b border-amber-200">
          {error}
        </p>
      )}
      <ConversationList
        conversations={conversations}
        userType="model"
        basePath="/model/chat"
      />
    </>
  );
}
