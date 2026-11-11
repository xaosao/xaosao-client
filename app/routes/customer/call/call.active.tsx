/**
 * The customer's call screen.
 *
 * One screen covers ringing and talking: the customer is in the room
 * from the moment they place the call, and the meter only starts when
 * the model joins, so there is nothing to wait on a separate page for.
 *
 * Reloading mid-call is safe — the token is re-issued by the loader.
 */

import { redirect, useLoaderData, type LoaderFunctionArgs } from "react-router";

import { CallStage } from "~/components/call/CallStage";
import { requireUserSession } from "~/services/auths.server";
import { getCallState, getCallToken } from "~/services/call.server";
import { prisma } from "~/services/database.server";

export async function loader({ request, params }: LoaderFunctionArgs) {
  const customerId = await requireUserSession(request);
  const sessionId = params.sessionId as string;
  const who = { userId: customerId as string, userType: "customer" as const };

  const token = await getCallToken(who, sessionId);
  // An ended call has no token; send them straight to what it cost.
  if (!token.ok) {
    return redirect(`/customer/call/summary/${sessionId}`);
  }

  const state = await getCallState(who, sessionId);

  // The model's name and photo for the screen — the call API deals in
  // ids, and this page is already behind the customer's session.
  const session = await prisma.call_session
    .findUnique({ where: { id: sessionId }, select: { modelId: true } })
    .catch(() => null);
  const model = session?.modelId
    ? await prisma.model.findUnique({
        where: { id: session.modelId },
        select: { firstName: true, lastName: true, profile: true },
      })
    : null;

  return {
    call: token.call,
    state,
    peerName:
      `${model?.firstName ?? ""} ${model?.lastName ?? ""}`.trim() || "Model",
    peerPhoto: model?.profile ?? null,
  };
}

export default function CustomerCallScreen() {
  const { call, state, peerName, peerPhoto } = useLoaderData<typeof loader>();

  return (
    <CallStage
      call={call}
      initialState={state}
      viewer="customer"
      peerName={peerName}
      peerPhoto={peerPhoto}
      summaryPath={`/customer/call/summary/${call.session_id}`}
    />
  );
}
