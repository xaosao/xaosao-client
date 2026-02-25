import { type ActionFunctionArgs } from "react-router";
import { requireUserSession } from "~/services/auths.server";
import { toggleInterest } from "~/services/post.server";

export async function action({ params, request }: ActionFunctionArgs) {
  const customerId = await requireUserSession(request);
  const postId = params.id!;

  try {
    const isInterested = await toggleInterest(postId, customerId, "customer");
    return { success: true, isInterested };
  } catch (error: any) {
    return { success: false, error: error?.message || "Failed to toggle interest" };
  }
}
