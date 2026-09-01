/**
 * Resource route: open (or create) a chat with a model.
 *
 * Access is decided by one rule: an active subscription grants unlimited chat.
 * xs_backend applies the same check server-side as a backstop.
 *
 * On success: redirect to the thread.
 * On refusal: return `{ canChat: false, reason: "subscribe" }` so the caller
 * can open <ChatAccessModal> prompting them to subscribe.
 */

import type { ActionFunctionArgs } from "react-router";
import { redirect } from "react-router";
import { requireVerifiedUserSession } from "~/services/auths.server";
import { checkChatAccess } from "~/services/chat-access.server";
import { startConversation, XsApiError } from "~/services/xs-chat.server";

export async function action({ request }: ActionFunctionArgs) {
  const customerId = await requireVerifiedUserSession(request);

  const formData = await request.formData();
  const modelId = (formData.get("modelId") as string | null)?.trim() || null;
  const bookingId = (formData.get("bookingId") as string | null) || undefined;

  if (!modelId) {
    return { canChat: false, reason: "invalid" };
  }

  const access = await checkChatAccess(customerId, modelId);
  if (!access.canChat) {
    return access;
  }

  try {
    const conversation = await startConversation(
      { userId: customerId, userType: "customer" },
      modelId,
      { bookingId }
    );
    return redirect(`/customer/chat/${conversation.id}`);
  } catch (error) {
    const message =
      error instanceof XsApiError
        ? error.message
        : "Unable to open this chat right now.";
    console.error("[customer/chat/start]", message);
    return { canChat: false, reason: "error", message };
  }
}
