/**
 * Customer chat — conversation list.
 *
 * Replaces the old iframe wrapper that embedded a separate chat app: this
 * renders natively and reads from the xs_backend chat API, so the web list
 * matches the mobile app's exactly (same ordering, unread counts, online dots).
 */

import type { LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";
import { requireVerifiedUserSession } from "~/services/auths.server";
import { listConversations } from "~/services/xs-chat.server";
import { ConversationList } from "~/components/chat/ConversationList";

export async function loader({ request }: LoaderFunctionArgs) {
  const customerId = await requireVerifiedUserSession(request);

  try {
    const { conversations } = await listConversations({
      userId: customerId,
      userType: "customer",
    });
    return { conversations, error: null };
  } catch (error) {
    // A chat outage shouldn't render an error page over the whole tab —
    // show an empty list with a message instead.
    console.error("[customer/chat] list failed:", (error as Error)?.message);
    return {
      conversations: [],
      error: (error as Error)?.message ?? "Unable to load conversations",
    };
  }
}

export default function CustomerConversations() {
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
        userType="customer"
        basePath="/customer/chat"
      />
    </>
  );
}
