/** Resource route: older messages for a model conversation. */

import type { LoaderFunctionArgs } from "react-router";
import { requireModelSession } from "~/services/model-auth.server";
import { getMessages } from "~/services/xs-chat.server";

export async function loader({ request, params }: LoaderFunctionArgs) {
  const modelId = await requireModelSession(request);
  const url = new URL(request.url);
  const page = Math.max(1, Number(url.searchParams.get("page")) || 1);

  try {
    const { messages, hasMore } = await getMessages(
      { userId: modelId, userType: "model" },
      params.conversationId!,
      { page, limit: 40 }
    );
    return { messages, hasMore };
  } catch (error) {
    console.error("[model/chat] load older failed:", (error as Error)?.message);
    return { messages: [], hasMore: false };
  }
}
