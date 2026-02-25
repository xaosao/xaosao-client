import { useTranslation } from "react-i18next";
import { useFetcher, useNavigate } from "react-router";
import { Heart, Send, MessageCircle, Loader, MoreHorizontal } from "lucide-react";
import PostImageGallery from "~/components/posts/PostImageGallery";
import { calculateAgeFromDOB, getTimeAgo } from "~/utils";
import type { PostItem } from "~/types/post";

interface FeedPostCardProps {
  post: PostItem;
  hasSubscription?: boolean;
}

export default function FeedPostCard({ post, hasSubscription }: FeedPostCardProps) {
  const { t } = useTranslation();
  const fetcher = useFetcher();
  const navigate = useNavigate();

  const isToggling = fetcher.state !== "idle";
  const optimisticInterested = fetcher.formData
    ? !post.isInterested
    : post.isInterested;

  const author = post.author;
  const authorName = author ? `${author.firstName} ${author.lastName || ""}`.trim() : "User";
  const age = author?.dob ? calculateAgeFromDOB(author.dob) : null;
  const timeAgo = getTimeAgo(post.createdAt, t);
  const serviceName = post.service?.name
    ? t(`modelServices.serviceItems.${post.service.name}.name`, { defaultValue: post.service.name })
    : null;
  const hasImages = post.images?.length > 0;

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `XaoSao - ${authorName}`,
          text: post.content,
          url: window.location.origin + `/post/${post.id}`,
        });
      } catch {}
    }
  };

  return (
    <div className={`bg-white ${!hasImages ? "pb-2" : ""}`}>
      {/* Header — avatar | name + time | menu */}
      <div className="flex items-center justify-between px-4 py-3">
        <div
          className="flex items-center gap-3 cursor-pointer min-w-0"
          onClick={() => author?.id && navigate(`/customer/model-profile/${author.id}`)}
        >
          <div className="relative flex-shrink-0">
            {author?.profile ? (
              <img
                src={author.profile}
                alt={authorName}
                className="w-9 h-9 rounded-full object-cover ring-2 ring-rose-100"
              />
            ) : (
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-rose-400 to-pink-500 flex items-center justify-center">
                <span className="text-white text-sm font-semibold">{authorName.charAt(0).toUpperCase()}</span>
              </div>
            )}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold truncate">{authorName}</span>
              {age && <span className="text-xs text-gray-400">{age}</span>}
              {serviceName && (
                <span className="text-xs text-rose-500 font-medium truncate">{serviceName}</span>
              )}
            </div>
            <span className="text-xs text-gray-400">{timeAgo}</span>
          </div>
        </div>
        <button onClick={handleShare} className="p-1 text-gray-400 hover:text-gray-600">
          <MoreHorizontal className="h-5 w-5" />
        </button>
      </div>

      {/* Content */}
      <div className={`px-4 ${hasImages ? "pb-3" : "pb-4"}`}>
        <p className="text-sm text-gray-900 whitespace-pre-wrap leading-relaxed">{post.content}</p>
      </div>

      {/* Image — full width, edge-to-edge */}
      {hasImages && (
        <PostImageGallery images={post.images} authorName={authorName} />
      )}

      {/* Action icons row */}
      <div className="flex items-center justify-between px-3 py-2">
        <div className="flex items-center gap-1">
          {/* Heart / Interested */}
          <fetcher.Form method="post" action={`/customer/posts/${post.id}/interested`}>
            <button
              type="submit"
              disabled={isToggling}
              className="p-2 hover:opacity-60 transition-opacity"
            >
              {isToggling ? (
                <Loader className="h-6 w-6 animate-spin text-gray-400" />
              ) : (
                <Heart
                  className={`h-6 w-6 ${
                    optimisticInterested
                      ? "fill-red-500 text-red-500"
                      : "text-gray-800"
                  }`}
                />
              )}
            </button>
          </fetcher.Form>

          {/* Chat — WhatsApp (subscription required) */}
          {hasSubscription && author?.whatsapp && (
            <button
              className="p-2 hover:opacity-60 transition-opacity"
              onClick={() => window.open(`https://wa.me/${author.whatsapp}`, "_blank")}
            >
              <MessageCircle className="h-6 w-6 text-gray-800" />
            </button>
          )}

          {/* Share */}
          <button className="p-2 hover:opacity-60 transition-opacity" onClick={handleShare}>
            <Send className="h-5 w-5 text-gray-800" />
          </button>
        </div>
      </div>

      {/* Interested count */}
      {post.interestedCount > 0 && (
        <div className="px-4 pb-1">
          <span className="text-sm font-semibold">
            {post.interestedCount} {t("posts.peopleInterested", { defaultValue: "interested" })}
          </span>
        </div>
      )}

      {/* Bottom padding for spacing */}
      <div className="h-1" />
    </div>
  );
}
