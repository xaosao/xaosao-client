/**
 * One resource route behind every call screen.
 *
 * Intents:
 *   start   — customer places a call (holds the money, rings the model)
 *   answer  — model picks up, gets a token
 *   decline — model rejects
 *   hangup  — either side ends it; the reply is the final bill
 *   state   — the server's view of the meter (GET)
 *
 * Nothing here decides anything: it only carries the session cookie to
 * xs_backend, which owns the rules. The browser is never trusted with
 * how long a call ran.
 */

import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";

import { getUserFromSession } from "~/services/auths.server";
import { getModelFromSession } from "~/services/model-auth.server";
import {
  answerCall,
  declineCall,
  getCallState,
  hangUpCall,
  startCall,
} from "~/services/call.server";

/** Whichever of the two sessions this request carries. */
async function whoIsAsking(request: Request) {
  const customerId = await getUserFromSession(request);
  if (customerId) {
    return { userId: customerId as string, userType: "customer" as const };
  }
  const modelId = await getModelFromSession(request);
  if (modelId) {
    return { userId: modelId as string, userType: "model" as const };
  }
  return null;
}

export async function loader({ request }: LoaderFunctionArgs) {
  const who = await whoIsAsking(request);
  if (!who) return { error: "Please sign in again." };

  const sessionId = new URL(request.url).searchParams.get("sessionId");
  if (!sessionId) return { error: "Missing call id" };

  return { state: await getCallState(who, sessionId) };
}

export async function action({ request }: ActionFunctionArgs) {
  const who = await whoIsAsking(request);
  if (!who) return { ok: false, error: "Please sign in again." };

  const formData = await request.formData();
  const intent = (formData.get("intent") as string) || "";
  const sessionId = (formData.get("sessionId") as string) || "";

  if (intent === "start") {
    if (who.userType !== "customer") {
      return { ok: false, error: "Only customers can place calls." };
    }
    const modelId = (formData.get("modelId") as string) || "";
    const callType =
      (formData.get("callType") as string) === "video" ? "video" : "audio";
    return startCall(who, modelId, callType);
  }

  if (!sessionId) return { ok: false, error: "Missing call id" };

  if (intent === "answer") return answerCall(who, sessionId);
  if (intent === "decline") return declineCall(who, sessionId);
  if (intent === "hangup") return hangUpCall(who, sessionId);

  return { ok: false, error: "Unknown action" };
}
