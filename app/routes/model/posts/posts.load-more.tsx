import type { LoaderFunction } from "react-router";
import { requireModelSession } from "~/services/model-auth.server";
import { getPostsFeed, getMyPosts } from "~/services/post.server";

export const loader: LoaderFunction = async ({ request }) => {
  const modelId = await requireModelSession(request);
  const url = new URL(request.url);
  const type = url.searchParams.get("type") || "feed";
  const page = parseInt(url.searchParams.get("page") || "1");
  const limit = parseInt(url.searchParams.get("limit") || "20");
  const serviceId = url.searchParams.get("service") || undefined;

  if (type === "myPosts") {
    const result = await getMyPosts(modelId, "model", page, limit);
    return {
      posts: result.posts,
      total: result.total,
      page: result.page,
      totalPages: result.totalPages,
      hasMore: result.page < result.totalPages,
    };
  }

  const result = await getPostsFeed("model", modelId, { serviceId, page, limit });
  return {
    posts: result.posts,
    total: result.total,
    page: result.page,
    totalPages: result.totalPages,
    hasMore: result.page < result.totalPages,
  };
};
