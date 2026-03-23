import { useTranslation } from "react-i18next";
import { useFetcher, useNavigate } from "react-router";
import { Heart, MessageCircle, Loader, Coins, MapPin } from "lucide-react";

import type { PostItem, UserProfile } from "~/types/post";
import { calculateAgeFromDOB, getTimeAgo } from "~/utils";
import PostImageGallery from "~/components/posts/PostImageGallery";

interface CustomerRequestCardProps {
  post: PostItem;
  modelProfile?: UserProfile | null;
}

export default function CustomerRequestCard({ post, modelProfile }: CustomerRequestCardProps) {
  const { t } = useTranslation();
  const fetcher = useFetcher();
  const navigate = useNavigate();

  const isToggling = fetcher.state !== "idle";
  const optimisticInterested = fetcher.formData
    ? !post.isInterested
    : post.isInterested;

  const author = post.author;
  const authorName = author ? `${author.firstName} ${author.lastName || ""}`.trim() : "Customer";
  const age = author?.dob ? calculateAgeFromDOB(author.dob) : null;
  const timeAgo = getTimeAgo(post.createdAt, t);
  const serviceName = post.service?.name
    ? t(`modelServices.serviceItems.${post.service.name}.name`, { defaultValue: post.service.name })
    : null;
  const hasImages = post.images?.length > 0;

  const modelName = modelProfile
    ? `${modelProfile.firstName} ${modelProfile.lastName || ""}`.trim()
    : "";
  const profileLink = modelProfile?.id
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/customer/user-profile/${modelProfile.id}`
    : "";

  const handleChat = () => {
    if (!author?.whatsapp) return;
    const message = t("posts.chatMessage", {
      name: modelName,
      link: profileLink,
      defaultValue: `Hi, I'm ${modelName} and I'm ready to service you for the day and service you want.\nPlease booking at: ${profileLink}`,
    });
    window.open(`https://wa.me/${author.whatsapp}?text=${encodeURIComponent(message)}`, "_blank");
  };

  return (
    <div className={`rounded-sm bg-white ${!hasImages ? "pb-2" : ""} ${post.hasTip ? "sm:border-transparent border border-yellow-300" : ""}`}>
      <div className="flex items-center justify-between px-4 py-3">
        <div
          className="flex items-center gap-3 cursor-pointer min-w-0"
          onClick={() => author?.id && navigate(`/model/customer-profile/${author.id}`)}
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
            <div className="flex items-center gap-1">
              <span className="text-sm font-semibold truncate">{authorName}</span>
              <span>-</span>
              {age && <span className="text-xs text-gray-400">{age} y</span>}
            </div>
            <span className="text-xs text-gray-400">{timeAgo}</span>
          </div>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {post.hasTip && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-600 flex items-center gap-1">
              <Coins className="h-3 w-3" />
              {t("tipBadge", { defaultValue: "+Tip" })}
            </span>
          )}
          {serviceName && (
            <span className="text-xs px-2 py-1 rounded-full bg-rose-100 text-rose-600">
              {serviceName}
            </span>
          )}
        </div>
      </div>

      <div className={`px-4 ${hasImages ? "pb-3" : "pb-4"}`}>
        <p className="text-sm text-gray-900 whitespace-pre-wrap leading-relaxed">{post.content}</p>

        {(post.targetGender || post.location) && (
          <div className="flex flex-wrap gap-1.5 mt-2">
            {post.targetGender && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-rose-100 text-rose-600">
                {post.targetGender === "female"
                  ? t("posts.female", { defaultValue: "Female" })
                  : t("posts.male", { defaultValue: "Male" })}
              </span>
            )}
            {post.location && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-rose-100 text-rose-600 flex items-center gap-0.5">
                <MapPin className="h-3 w-3" />
                {post.location}
              </span>
            )}
          </div>
        )}
      </div>

      {hasImages && (
        <PostImageGallery images={post.images} authorName={authorName} />
      )}

      <div className="flex items-center justify-between px-3 py-2">
        <div className="w-full flex items-center justify-between">
          <div className="flex items-center gap-1">
            <fetcher.Form method="post" action={`/model/posts/${post.id}/interested`}>
              <button
                type="submit"
                disabled={isToggling}
                className="text-gray-500 flex items-center justify-center gap-1 p-2 hover:opacity-60 transition-opacity"
              >
                {isToggling ? (
                  <Loader className="text-gray-500 h-4 w-4 animate-spin" />
                ) : (
                  <Heart
                    className={`cursor-pointer h-4 w-4 ${optimisticInterested
                      ? "fill-red-500 text-red-500"
                      : "text-gray-500"
                      }`}
                  />
                )}
                <span className="text-sm font-semibold">
                  {/* {post.interestedCount} */}
                  {t("posts.peopleInterested", { defaultValue: "interested" })}
                </span>
              </button>
            </fetcher.Form>
          </div>

          {/* Comment */}
          <button
            className="cursor-pointer flex items-center gap-1 p-2 hover:opacity-60 transition-opacity text-gray-500"
            onClick={() => navigate(`/model/posts/${post.id}`)}
          >
            {(post._count?.comments ?? 0) > 0 ? (
              <span className="bg-gray-500 text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
                {post._count?.comments}
              </span>
            ) : (
              <MessageCircle className="h-4 w-4" />
            )}
            <span className="text-sm">{t("posts.comment", { defaultValue: "Comment" })}</span>
          </button>

          {author?.whatsapp && (
            <button
              className="cursor-pointer text-gray-500 flex items-center justify-center gap-1 px-2 py-1 hover:opacity-60 transition-opacity text-sm border border-green-300 bg-green-50 text-green-500 rounded-md"
              onClick={handleChat}
            >
              <MessageCircle className="h-3.5 w-3.5" /> {t("posts.chat", { defaultValue: "Chat" })}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
