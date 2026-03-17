import { type ActionFunctionArgs } from "react-router";
import { requireUserSession } from "~/services/auths.server";
import { sendGift } from "~/services/gift.server";

export async function action({ params, request }: ActionFunctionArgs) {
  const customerId = await requireUserSession(request);
  const postId = params.id!;

  try {
    const formData = await request.formData();
    const giftId = formData.get("giftId") as string;

    if (!giftId) {
      return { success: false, error: "Gift ID is required" };
    }

    const result = await sendGift(customerId, postId, giftId);
    return { success: true, ...result };
  } catch (error: any) {
    const message =
      error?.fieldErrors?.message || error?.message || "Failed to send gift";
    return { success: false, error: message };
  }
}
