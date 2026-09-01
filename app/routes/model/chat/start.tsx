/**
 * Resource route: open (or create) a chat with a customer.
 *
 * Models can always initiate — xs_backend only gates the customer side on
 * subscription — so there is no website-level check here.
 */

import type { ActionFunctionArgs } from "react-router";
import { redirect } from "react-router";
import { requireModelSession } from "~/services/model-auth.server";
import { startConversation, XsApiError } from "~/services/xs-chat.server";

export async function action({ request }: ActionFunctionArgs) {
  const modelId = await requireModelSession(request);

  const formData = await request.formData();
  const customerId = (formData.get("customerId") as string | null)?.trim();
  const bookingId = (formData.get("bookingId") as string | null) || undefined;

  if (!customerId) {
    return { error: "Missing customer" };
  }

  try {
    const conversation = await startConversation(
      { userId: modelId, userType: "model" },
      customerId,
      { bookingId }
    );
    return redirect(`/model/chat/${conversation.id}`);
  } catch (error) {
    const message =
      error instanceof XsApiError
        ? error.message
        : "Unable to open this chat right now.";
    console.error("[model/chat/start]", message);
    return { error: message };
  }
}
