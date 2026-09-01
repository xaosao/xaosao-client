/**
 * Chat access check endpoint.
 *
 * Thin wrapper over `checkChatAccess` — the rules themselves live in
 * services/chat-access.server.ts so the in-app chat "start" flow enforces the
 * identical gate. See that file for the ordering of the rules.
 */

import type { LoaderFunctionArgs } from "react-router";
import { requireUserSession } from "~/services/auths.server";
import { checkChatAccess } from "~/services/chat-access.server";

export async function loader({ request }: LoaderFunctionArgs) {
  try {
    const customerId = await requireUserSession(request);
    const modelId = new URL(request.url).searchParams.get("modelId");
    return await checkChatAccess(customerId, modelId);
  } catch (e) {
    console.error("[check-booking] Error:", e);
    return { canChat: false, reason: "error" };
  }
}
