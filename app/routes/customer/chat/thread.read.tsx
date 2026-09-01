/**
 * Resource route: mark a customer conversation read.
 *
 * Resets the unread counter in Mongo. The "seen" tick on the other side is
 * driven separately by the socket's `mark_read` event — the REST endpoint
 * doesn't emit one.
 */

import type { ActionFunctionArgs } from "react-router";
import { requireVerifiedUserSession } from "~/services/auths.server";
import { markConversationRead } from "~/services/xs-chat.server";

export async function action({ request, params }: ActionFunctionArgs) {
  const customerId = await requireVerifiedUserSession(request);
  const formData = await request.formData();
  const lastMessageId = (formData.get("lastMessageId") as string) || undefined;

  try {
    await markConversationRead(
      { userId: customerId, userType: "customer" },
      params.conversationId!,
      lastMessageId
    );
    return { success: true };
  } catch (error) {
    console.error("[customer/chat] mark read failed:", (error as Error)?.message);
    return { success: false };
  }
}
