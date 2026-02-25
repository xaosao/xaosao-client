import { type ActionFunctionArgs } from "react-router";
import { requireModelSession } from "~/services/model-auth.server";
import { toggleInterest } from "~/services/post.server";

export async function action({ params, request }: ActionFunctionArgs) {
  const modelId = await requireModelSession(request);
  const postId = params.id!;

  try {
    const isInterested = await toggleInterest(postId, modelId, "model");
    return { success: true, isInterested };
  } catch (error: any) {
    return { success: false, error: error?.message || "Failed to toggle interest" };
  }
}
