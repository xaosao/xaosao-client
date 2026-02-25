import { redirect, type ActionFunctionArgs } from "react-router";
import { requireUserSession } from "~/services/auths.server";
import { deletePost } from "~/services/post.server";

export async function action({ params, request }: ActionFunctionArgs) {
  const customerId = await requireUserSession(request);
  const postId = params.id!;

  try {
    await deletePost(postId, customerId, "customer");
    return redirect("/customer/posts");
  } catch (error: any) {
    return { success: false, error: error?.message || "Failed to delete post" };
  }
}
