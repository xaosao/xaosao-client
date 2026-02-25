import type { LoaderFunction, MetaFunction } from "react-router";
import { useNavigate } from "react-router";
import { getPostForShare } from "~/services/post.server";

interface LoaderReturn {
  post: {
    id: string;
    content: string;
    images: string[];
    authorType: string;
    status: string;
    createdAt: string;
    service?: { name: string } | null;
    author?: { firstName: string; lastName?: string | null; profile?: string | null } | null;
  } | null;
  baseUrl: string;
}

export const loader: LoaderFunction = async ({ params }) => {
  const postId = params.id;
  if (!postId) return { post: null, baseUrl: "" };

  const raw = await getPostForShare(postId);
  if (!raw) return { post: null, baseUrl: "" };

  const author = raw.authorType === "customer" ? raw.customer : raw.model;

  return {
    post: {
      id: raw.id,
      content: raw.content,
      images: raw.images,
      authorType: raw.authorType,
      status: raw.status,
      createdAt: raw.createdAt.toISOString(),
      service: raw.service,
      author,
    },
    baseUrl: process.env.VITE_FRONTEND_URL || "",
  };
};

export const meta: MetaFunction = ({ data }) => {
  const { post, baseUrl } = (data as LoaderReturn) || {};

  if (!post) {
    return [
      { title: "Post Not Found - XaoSao" },
      { name: "description", content: "This post is no longer available." },
    ];
  }

  const authorName = post.author
    ? `${post.author.firstName} ${post.author.lastName || ""}`.trim()
    : "XaoSao User";

  const title = `${authorName} on XaoSao`;
  const description = post.content.length > 160
    ? post.content.substring(0, 157) + "..."
    : post.content;

  // Use first post image, or author profile, or a default
  const image = post.images?.length > 0
    ? post.images[0]
    : post.author?.profile || "";

  const url = `${baseUrl}/post/${post.id}`;

  return [
    { title },
    { name: "description", content: description },
    // Open Graph
    { property: "og:type", content: "article" },
    { property: "og:title", content: title },
    { property: "og:description", content: description },
    { property: "og:url", content: url },
    ...(image ? [{ property: "og:image", content: image }] : []),
    { property: "og:site_name", content: "XaoSao" },
    // Twitter Card
    { name: "twitter:card", content: image ? "summary_large_image" : "summary" },
    { name: "twitter:title", content: title },
    { name: "twitter:description", content: description },
    ...(image ? [{ name: "twitter:image", content: image }] : []),
  ];
};

interface PageProps {
  loaderData: LoaderReturn;
}

export default function PostSharePage({ loaderData }: PageProps) {
  const { post, baseUrl } = loaderData;
  const navigate = useNavigate();

  if (!post) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="text-center">
          <h1 className="text-xl font-bold text-gray-800 mb-2">Post Not Found</h1>
          <p className="text-gray-500 text-sm mb-4">This post may have been deleted or expired.</p>
          <a
            href="/"
            className="inline-block px-4 py-2 bg-rose-500 text-white rounded-lg text-sm font-medium hover:bg-rose-600"
          >
            Go to XaoSao
          </a>
        </div>
      </div>
    );
  }

  const authorName = post.author
    ? `${post.author.firstName} ${post.author.lastName || ""}`.trim()
    : "XaoSao User";

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-lg max-w-lg w-full overflow-hidden">
        {/* Author header */}
        <div className="p-4 flex items-center gap-3 border-b">
          {post.author?.profile ? (
            <img
              src={post.author.profile}
              alt={authorName}
              className="w-12 h-12 rounded-full object-cover border border-gray-200"
            />
          ) : (
            <div className="w-12 h-12 rounded-full bg-rose-100 flex items-center justify-center">
              <span className="text-rose-500 font-bold text-lg">
                {authorName.charAt(0).toUpperCase()}
              </span>
            </div>
          )}
          <div>
            <p className="font-medium text-gray-900">{authorName}</p>
            <p className="text-xs text-gray-400">
              {new Date(post.createdAt).toLocaleDateString()}
              {post.service?.name && ` · ${post.service.name}`}
            </p>
          </div>
        </div>

        {/* Content */}
        <div className="p-4">
          <p className="text-gray-800 whitespace-pre-wrap">{post.content}</p>
        </div>

        {/* First image preview */}
        {post.images?.length > 0 && (
          <div>
            <img
              src={post.images[0]}
              alt={`Post by ${authorName}`}
              className="w-full max-h-96 object-cover"
            />
            {post.images.length > 1 && (
              <p className="text-center text-xs text-gray-400 py-1">
                +{post.images.length - 1} more photo{post.images.length > 2 ? "s" : ""}
              </p>
            )}
          </div>
        )}

        {/* CTA */}
        <div className="p-4 border-t">
          <a
            href="/"
            className="block w-full text-center py-3 bg-rose-500 text-white rounded-lg font-medium hover:bg-rose-600 transition-colors"
          >
            Open in XaoSao
          </a>
          <p className="text-center text-xs text-gray-400 mt-2">
            XaoSao — Find your perfect match
          </p>
        </div>
      </div>
    </div>
  );
}
