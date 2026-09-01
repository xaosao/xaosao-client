/**
 * Resource route: open (or create) a chat with a model.
 *
 * The website's own access rules run first — active booking, subscription
 * tier, free daily slot, or a direct gift. Only if they pass do we ask
 * xs_backend for the conversation, which applies its own subscription check as
 * a backstop.
 *
 * On success: redirect to the thread.
 * On refusal: return `{ canChat: false, reason }` so the caller can open
 * <ChatAccessModal> with the right copy (subscribe / gift_required / …).
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
