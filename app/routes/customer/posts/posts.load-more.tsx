import type { LoaderFunction } from "react-router";
import { requireUserSession } from "~/services/auths.server";
import { getPostsFeed, getMyPosts } from "~/services/post.server";

export const loader: LoaderFunction = async ({ request }) => {
  const customerId = await requireUserSession(request);
  const url = new URL(request.url);
  const type = url.searchParams.get("type") || "feed";
  const page = parseInt(url.searchParams.get("page") || "1");
  const limit = parseInt(url.searchParams.get("limit") || "20");
  const serviceId = url.searchParams.get("service") || undefined;

  if (type === "myPosts") {
    const result = await getMyPosts(customerId, "customer", page, limit);
    return {
      posts: result.posts,
      total: result.total,
      page: result.page,
      totalPages: result.totalPages,
      hasMore: result.page < result.totalPages,
    };
  }

  const result = await getPostsFeed("customer", customerId, { serviceId, page, limit });
  return {
    posts: result.posts,
    total: result.total,
    page: result.page,
    totalPages: result.totalPages,
    hasMore: result.page < result.totalPages,
  };
};
