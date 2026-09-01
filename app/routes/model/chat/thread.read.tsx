/** Resource route: mark a model conversation read. */

import type { ActionFunctionArgs } from "react-router";
import { requireModelSession } from "~/services/model-auth.server";
import { markConversationRead } from "~/services/xs-chat.server";

export async function action({ request, params }: ActionFunctionArgs) {
  const modelId = await requireModelSession(request);
  const formData = await request.formData();
  const lastMessageId = (formData.get("lastMessageId") as string) || undefined;

  try {
    await markConversationRead(
      { userId: modelId, userType: "model" },
      params.conversationId!,
      lastMessageId
    );
    return { success: true };
  } catch (error) {
    console.error("[model/chat] mark read failed:", (error as Error)?.message);
    return { success: false };
  }
}
