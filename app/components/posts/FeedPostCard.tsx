import { useTranslation } from "react-i18next";
import { useFetcher, useNavigate } from "react-router";
import { Heart, MessageCircle, Loader, CalendarCheck } from "lucide-react";

import { calculateAgeFromDOB, getTimeAgo } from "~/utils";
import type { PostItem, UserProfile } from "~/types/post";
import PostImageGallery from "~/components/posts/PostImageGallery";

interface FeedPostCardProps {
  post: PostItem;
  customerProfile?: UserProfile | null;
}

export default function FeedPostCard({ post, customerProfile }: FeedPostCardProps) {
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

  const customerName = customerProfile
    ? `${customerProfile.firstName} ${customerProfile.lastName || ""}`.trim()
    : "";

  const handleChat = () => {
    if (!author?.whatsapp) return;
    const message = t("posts.customerChatMessage", {
      modelName: authorName,
      customerName,
      defaultValue: `Hi, ${authorName}.\nI'm ${customerName}, I see your post looking for a partner to hang out tonight.\nAre you still available? I'll book you.`,
    });
    window.open(`https://wa.me/${author.whatsapp}?text=${encodeURIComponent(message)}`, "_blank");
  };

  return (
    <div className={`rounded-sm bg-white ${!hasImages ? "pb-2" : ""}`}>
      <div className="flex items-center justify-between px-4 py-3">
        <div
          className="flex items-center gap-3 cursor-pointer min-w-0"
          onClick={() => author?.id && navigate(`/customer/user-profile/${author.id}`)}
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
              <span className="text-sm font-semibold truncate">{authorName} -</span>
              {age && <span className="text-sm text-gray-400">{age}y</span>}
              {serviceName && (
                <span className="text-xs text-rose-500 font-medium truncate">{serviceName}</span>
              )}
            </div>
            <span className="text-xs text-gray-400">{timeAgo}</span>
          </div>
        </div>
        <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-600">
          {t("posts.stillAvailable", { defaultValue: "Available" })}
        </span>
      </div>

      <div className={`px-4 ${hasImages ? "pb-3" : "pb-4"}`}>
        <p className="text-sm text-gray-900 whitespace-pre-wrap leading-relaxed">{post.content}</p>
      </div>

      {hasImages && (
        <PostImageGallery images={post.images} authorName={authorName} />
      )}

      <div className="flex items-center justify-between px-3 py-2">
        <div className="flex items-center gap-1">
          {/* Interest */}
          <fetcher.Form method="post" action={`/customer/posts/${post.id}/interested`}>
            <button
              type="submit"
              disabled={isToggling}
              className="cursor-pointer flex items-center gap-1 p-2 hover:opacity-60 transition-opacity"
            >
              {isToggling ? (
                <Loader className="h-4 w-4 animate-spin text-gray-400" />
              ) : (
                <Heart
                  className={`h-4 w-4 ${optimisticInterested
                    ? "fill-red-500 text-red-500"
                    : "text-gray-500"
                    }`}
                />
              )}
              <span className={`text-sm ${optimisticInterested ? "text-red-500 font-semibold" : "text-gray-500"}`}>
                {t("posts.interested", { defaultValue: "Interested" })}
              </span>
            </button>
          </fetcher.Form>

          {/* Chat */}
          {author?.whatsapp && (
            <button
              className="cursor-pointer flex items-center gap-1 p-2 hover:opacity-60 transition-opacity text-gray-500"
              onClick={handleChat}
            >
              <MessageCircle className="h-4 w-4" />
              <span className="text-sm">{t("posts.chat", { defaultValue: "Chat" })}</span>
            </button>
          )}
        </div>

        {/* Book Now */}
        {author?.id && (
          <button
            className="cursor-pointer flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-white bg-rose-500 hover:bg-rose-600 rounded-md transition-colors"
            onClick={() => navigate(`/customer/user-profile/${author.id}`)}
          >
            <CalendarCheck className="h-3.5 w-3.5" />
            {t("posts.bookNow", { defaultValue: "Book Now" })}
          </button>
        )}
      </div>
    </div>
  );
}
