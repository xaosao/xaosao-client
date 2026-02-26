import { redirect, type ActionFunctionArgs } from "react-router";
import { requireModelSession } from "~/services/model-auth.server";
import { deletePost } from "~/services/post.server";

export async function action({ params, request }: ActionFunctionArgs) {
  const modelId = await requireModelSession(request);
  const postId = params.id!;

  try {
    await deletePost(postId, modelId, "model");
    return redirect("/model");
  } catch (error: any) {
    return { success: false, error: error?.message || "Failed to delete post" };
  }
}
