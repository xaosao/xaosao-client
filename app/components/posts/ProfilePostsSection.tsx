import React from "react";
import { useTranslation } from "react-i18next";
import { useFetcher, Link } from "react-router";
import { Heart, Share2, Clock, MapPin, Calendar, CheckCircle, Trash2 } from "lucide-react";
import { Badge } from "~/components/ui/badge";
import PostImageGallery from "~/components/posts/PostImageGallery";
import { getTimeAgo } from "~/utils";

interface PostAuthor {
  id: string;
  firstName: string;
  lastName?: string | null;
  profile?: string | null;
}

interface PostService {
  id: string;
  name: string;
}

interface ProfilePost {
  id: string;
  content: string;
  images?: string[];
  authorType: string;
  status: string;
  preferredDate?: string | null;
  preferredTime?: string | null;
  location?: string | null;
  interestedCount: number;
  createdAt: string;
  service?: PostService | null;
  customer?: PostAuthor | null;
  model?: PostAuthor | null;
}

interface ProfilePostsSectionProps {
  posts: ProfilePost[];
  isOwnProfile: boolean;
  viewerType: "customer" | "model"; // Who is viewing
  basePath: string; // e.g., "/customer/posts" or "/model/posts"
}

export default function ProfilePostsSection({
  posts,
  isOwnProfile,
  viewerType,
  basePath,
}: ProfilePostsSectionProps) {
  const { t } = useTranslation();

  if (posts.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <p className="text-sm">
          {isOwnProfile
            ? t("posts.emptyMyPosts", { defaultValue: "You haven't created any posts yet." })
            : t("posts.emptyFeed", { defaultValue: "No posts yet. Check back later!" })}
        </p>
        {isOwnProfile && (
          <Link
            to={`${basePath}/create`}
            className="mt-3 inline-block text-sm text-rose-500 hover:text-rose-600 font-medium"
          >
            {t("posts.createFirst", { defaultValue: "Create your first post" })}
          </Link>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {posts.map((post) => (
        <ProfilePostCard
          key={post.id}
          post={post}
          isOwnProfile={isOwnProfile}
          viewerType={viewerType}
          basePath={basePath}
        />
      ))}
    </div>
  );
}

function ProfilePostCard({
  post,
  isOwnProfile,
  viewerType,
  basePath,
}: {
  post: ProfilePost;
  isOwnProfile: boolean;
  viewerType: "customer" | "model";
  basePath: string;
}) {
  const { t } = useTranslation();
  const fetcher = useFetcher();

  const timeAgo = getTimeAgo(post.createdAt, t);

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: post.content.slice(0, 50),
          text: post.content,
          url: `${basePath}/${post.id}`,
        });
      } catch {}
    }
  };

  return (
    <div className="border rounded-lg p-3 hover:border-rose-200 transition-colors">
      <div className="flex items-start justify-between mb-2">
        <p className="text-sm text-gray-800 flex-1">{post.content}</p>
        <span className="text-xs text-gray-400 whitespace-nowrap ml-2">{timeAgo}</span>
      </div>

      {/* Images */}
      {post.images && post.images.length > 0 && (
        <div className="mb-2 -mx-3">
          <PostImageGallery images={post.images} />
        </div>
      )}

      {/* Meta info */}
      <div className="flex flex-wrap gap-2 mb-2">
        {post.service && (
          <Badge variant="outline" className="text-xs bg-rose-50 text-rose-600 border-rose-200">
            {post.service.name}
          </Badge>
        )}
        {post.preferredDate && (
          <span className="flex items-center gap-1 text-xs text-gray-500">
            <Calendar size={12} />
            {new Date(post.preferredDate).toLocaleDateString()}
          </span>
        )}
        {post.preferredTime && (
          <span className="flex items-center gap-1 text-xs text-gray-500">
            <Clock size={12} />
            {post.preferredTime}
          </span>
        )}
        {post.location && (
          <span className="flex items-center gap-1 text-xs text-gray-500">
            <MapPin size={12} />
            {post.location}
          </span>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {!isOwnProfile && (
            <fetcher.Form method="post" action={`${basePath}/${post.id}/interested`}>
              <button
                type="submit"
                className="flex items-center gap-1 text-xs text-rose-500 hover:text-rose-600"
              >
                <Heart size={14} />
                {t("posts.interested", { defaultValue: "Interested" })}
              </button>
            </fetcher.Form>
          )}
          <button
            type="button"
            onClick={handleShare}
            className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700"
          >
            <Share2 size={14} />
            {t("posts.share", { defaultValue: "Share" })}
          </button>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-400">
            {post.interestedCount} {t("posts.peopleInterested", { defaultValue: "interested" })}
          </span>
          {isOwnProfile && post.status === "active" && (
            <>
              <fetcher.Form method="post" action={`${basePath}/${post.id}/fulfill`}>
                <button
                  type="submit"
                  className="flex items-center gap-1 text-xs text-green-600 hover:text-green-700"
                >
                  <CheckCircle size={14} />
                  {t("posts.markFulfilled", { defaultValue: "Fulfilled" })}
                </button>
              </fetcher.Form>
              <fetcher.Form method="post" action={`${basePath}/${post.id}/delete`}>
                <button
                  type="submit"
                  className="flex items-center gap-1 text-xs text-red-500 hover:text-red-600"
                >
                  <Trash2 size={14} />
                  {t("posts.delete", { defaultValue: "Delete" })}
                </button>
              </fetcher.Form>
            </>
          )}
          {isOwnProfile && post.status !== "active" && (
            <Badge
              variant="outline"
              className={`text-xs ${
                post.status === "fulfilled"
                  ? "bg-green-50 text-green-600 border-green-200"
                  : "bg-gray-50 text-gray-500 border-gray-200"
              }`}
            >
              {post.status === "fulfilled"
                ? t("posts.statusFulfilled", { defaultValue: "Fulfilled" })
                : t("posts.statusExpired", { defaultValue: "Expired" })}
            </Badge>
          )}
        </div>
      </div>
    </div>
  );
}

