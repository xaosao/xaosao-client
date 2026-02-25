import { redirect, type ActionFunctionArgs } from "react-router";
import { requireModelSession } from "~/services/model-auth.server";
import { markPostFulfilled } from "~/services/post.server";

export async function action({ params, request }: ActionFunctionArgs) {
  const modelId = await requireModelSession(request);
  const postId = params.id!;

  try {
    await markPostFulfilled(postId, modelId, "model");
    return redirect("/model/posts");
  } catch (error: any) {
    return { success: false, error: error?.message || "Failed to mark post as fulfilled" };
  }
}
