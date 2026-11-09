/**
 * Reward endpoint for the model area: the layout's popup reads state from
 * here and posts a claim back to it.
 *
 * A resource route rather than a loader on the layout, so checking for a
 * reward never blocks a page render and the popup can re-check on a timer
 * without a full navigation.
 */

import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { requireModelSession } from "~/services/model-auth.server";
import { claimReward, getRewardState } from "~/services/reward.server";

export async function loader({ request }: LoaderFunctionArgs) {
  const modelId = await requireModelSession(request);
  return await getRewardState(modelId);
}

export async function action({ request }: ActionFunctionArgs) {
  const modelId = await requireModelSession(request);
  const formData = await request.formData();
  const slotId = (formData.get("slotId") as string) ?? "";
  if (!slotId) return { ok: false, error: "Missing reward" };
  return await claimReward(modelId, slotId);
}
