/**
 * Check-in endpoint for the model area: the card reads state from here
 * and posts a claim back to it.
 *
 * A resource route rather than a loader on the page, so the card can
 * refresh itself after a claim without a full navigation.
 */

import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { requireModelSession } from "~/services/model-auth.server";
import { claimCheckin, getCheckinState } from "~/services/checkin.server";

export async function loader({ request }: LoaderFunctionArgs) {
  const modelId = await requireModelSession(request);
  return await getCheckinState(modelId);
}

export async function action({ request }: ActionFunctionArgs) {
  const modelId = await requireModelSession(request);
  return await claimCheckin(modelId);
}
