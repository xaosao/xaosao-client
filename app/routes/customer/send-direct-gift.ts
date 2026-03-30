import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { requireUserSession } from "~/services/auths.server";
import { getActiveGifts, sendDirectGift } from "~/services/gift.server";

// GET: Return list of available gifts
export async function loader({ request }: LoaderFunctionArgs) {
  await requireUserSession(request);
  const gifts = await getActiveGifts();
  return { gifts };
}

// POST: Send a direct gift to a model
export async function action({ request }: ActionFunctionArgs) {
  const customerId = await requireUserSession(request);
  const formData = await request.formData();
  const modelId = formData.get("modelId") as string;
  const giftId = formData.get("giftId") as string;

  if (!modelId || !giftId) {
    return { error: "Missing modelId or giftId" };
  }

  try {
    const result = await sendDirectGift(customerId, modelId, giftId);
    return result;
  } catch (error: any) {
    const message = error?.fieldErrors?.message || error?.message || "Failed to send gift";
    return { error: message };
  }
}
