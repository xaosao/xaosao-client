/**
 * Resource route: older messages for a customer conversation.
 * Fetched by ChatThread's "Load earlier messages" button.
 */

import type { LoaderFunctionArgs } from "react-router";
import { requireVerifiedUserSession } from "~/services/auths.server";
import { getMessages } from "~/services/xs-chat.server";

export async function loader({ request, params }: LoaderFunctionArgs) {
  const customerId = await requireVerifiedUserSession(request);
  const url = new URL(request.url);
  const page = Math.max(1, Number(url.searchParams.get("page")) || 1);

  try {
    const { messages, hasMore } = await getMessages(
      { userId: customerId, userType: "customer" },
      params.conversationId!,
      { page, limit: 40 }
    );
    return { messages, hasMore };
  } catch (error) {
    console.error(
      "[customer/chat] load older failed:",
      (error as Error)?.message
    );
    return { messages: [], hasMore: false };
  }
}
