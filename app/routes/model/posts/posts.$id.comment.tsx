import type { ActionFunctionArgs } from "react-router";
import { requireModelSession } from "~/services/model-auth.server";
import { createComment } from "~/services/post.server";

export async function action({ params, request }: ActionFunctionArgs) {
  const modelId = await requireModelSession(request);
  const formData = await request.formData();
  const content = formData.get("content") as string;
  const parentId = (formData.get("parentId") as string) || undefined;
  const replyToId = (formData.get("replyToId") as string) || undefined;

  try {
    const comment = await createComment(params.id!, modelId, "model", content, parentId, replyToId);
    return { success: true, comment };
  } catch (error: any) {
    const msg = error?.message || "";
    if (msg === "PHONE_NOT_ALLOWED") {
      return { success: false, error: true, message: "posts.create.phoneNotAllowed" };
    }
    if (msg.startsWith("PROFANITY_BLOCKED:")) {
      return { success: false, error: true, message: "posts.create.profanityBlocked" };
    }
    return { success: false, error: true, message: "posts.commentFailed" };
  }
}
