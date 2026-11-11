/**
 * The model's call screen.
 *
 * Same stage as the customer sees, with the number on screen meaning
 * earnings rather than spend. Reloading mid-call re-issues the token
 * rather than dropping the call.
 */

import { redirect, useLoaderData, type LoaderFunctionArgs } from "react-router";

import { CallStage } from "~/components/call/CallStage";
import { requireModelSession } from "~/services/model-auth.server";
import { getCallState, getCallToken } from "~/services/call.server";
import { prisma } from "~/services/database.server";

export async function loader({ request, params }: LoaderFunctionArgs) {
  const modelId = await requireModelSession(request);
  const sessionId = params.sessionId as string;
  const who = { userId: modelId as string, userType: "model" as const };

  const token = await getCallToken(who, sessionId);
  if (!token.ok) {
    return redirect(`/model/call/summary/${sessionId}`);
  }

  const state = await getCallState(who, sessionId);

  const session = await prisma.call_session
    .findUnique({ where: { id: sessionId }, select: { customerId: true } })
    .catch(() => null);
  const customer = session?.customerId
    ? await prisma.customer.findUnique({
        where: { id: session.customerId },
        select: { firstName: true, lastName: true, profile: true },
      })
    : null;

  return {
    call: token.call,
    state,
    peerName:
      `${customer?.firstName ?? ""} ${customer?.lastName ?? ""}`.trim() ||
      "Customer",
    peerPhoto: customer?.profile ?? null,
  };
}

export default function ModelCallScreen() {
  const { call, state, peerName, peerPhoto } = useLoaderData<typeof loader>();

  return (
    <CallStage
      call={call}
      initialState={state}
      viewer="model"
      peerName={peerName}
      peerPhoto={peerPhoto}
      summaryPath={`/model/call/summary/${call.session_id}`}
    />
  );
}
