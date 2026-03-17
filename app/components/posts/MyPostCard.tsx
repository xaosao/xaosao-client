import { useState, useRef } from "react";
import { getTimeAgo } from "~/utils";
import { useTranslation } from "react-i18next";
import { CheckCircle, Coins, Gift, Trash2 } from "lucide-react";
import { useFetcher, useNavigate } from "react-router";

// components and utils:
import { Badge } from "~/components/ui/badge";
import type { PostItem, UserProfile } from "~/types/post";
import PostImageGallery from "~/components/posts/PostImageGallery";

interface MyPostCardProps {
  post: PostItem;
  userType: "customer" | "model";
  userProfile?: UserProfile | null;
}

export default function MyPostCard({ post, userType, userProfile }: MyPostCardProps) {
  const { t } = useTranslation();
  const fetcher = useFetcher();
  const navigate = useNavigate();
  const [confirmAction, setConfirmAction] = useState<"fulfill" | "delete" | null>(null);
  const fulfillFormRef = useRef<HTMLFormElement>(null);
  const deleteFormRef = useRef<HTMLFormElement>(null);

  const serviceName = post.service?.name
    ? t(`modelServices.serviceItems.${post.service.name}.name`, { defaultValue: post.service.name })
    : null;

  const isActive = post.status === "active";
  const isFulfilled = post.status === "fulfilled";
  const interestCount = post._count?.interests || post.interestedCount || 0;
  const giftCount = post._count?.gifts || 0;
  const hasImages = post.images?.length > 0;
  const authorName = userProfile
    ? `${userProfile.firstName} ${userProfile.lastName || ""}`.trim()
    : "Me";

  const handleConfirm = () => {
    if (confirmAction === "fulfill") {
      fulfillFormRef.current?.requestSubmit();
    } else if (confirmAction === "delete") {
      deleteFormRef.current?.requestSubmit();
    }
    setConfirmAction(null);
  };

  return (
    <div
      className={`border-b py-4 border-gray-300 rounded-sm bg-white ${!isActive ? "opacity-90" : ""} ${post.hasTip ? "sm:border-gray-300 border-yellow-300" : ""}`}>
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="relative flex-shrink-0">
            {userProfile?.profile ? (
              <img
                src={userProfile.profile}
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
              {serviceName && (
                <span className="text-xs text-rose-500 font-medium truncate">{serviceName}</span>
              )}
              {post.hasTip && (
                <span className="text-xs px-1.5 py-0 rounded-full bg-amber-100 text-amber-600 flex items-center gap-0.5">
                  <Coins className="h-3 w-3" />
                  {t("tipBadge", { defaultValue: "+Tip" })}
                </span>
              )}
              <Badge
                variant="outline"
                className={`text-[10px] px-1.5 py-0 ${isActive
                  ? "border-green-200 text-green-600"
                  : isFulfilled
                    ? "border-blue-200 text-blue-600"
                    : "border-gray-200 text-gray-400"
                  }`}
              >
                {isActive
                  ? t("posts.statusActive", { defaultValue: "Active" })
                  : isFulfilled
                    ? t("posts.statusFulfilled", { defaultValue: "Fulfilled" })
                    : t("posts.statusExpired", { defaultValue: "Expired" })}
              </Badge>
            </div>
            <span className="text-xs text-gray-400">{getTimeAgo(post.createdAt, t)}</span>
          </div>
        </div>
      </div>

      <div className={`px-4 ${hasImages ? "pb-3" : "pb-4"}`}>
        <p className="text-sm text-gray-900 whitespace-pre-wrap leading-relaxed">{post.content}</p>
      </div>

      {hasImages && (
        <PostImageGallery images={post.images} />
      )}

      <div className="flex items-center justify-between px-4 py-2">
        <div className="flex items-center gap-2">
          {interestCount > 0 ? (
            <button
              onClick={() => navigate(`/${userType}/posts/${post.id}`)}
              className="text-sm font-semibold hover:text-rose-500 transition-colors border border-rose-300 px-2 py-1 rounded-full bg-rose-100 text-rose-500"
            >
              {interestCount} {t("posts.peopleInterested", { defaultValue: "interested" })}
            </button>
          ) : (
            <span className="text-sm text-gray-400">
              {t("posts.noInterest", { defaultValue: "No interest yet" })}
            </span>
          )}
          {giftCount > 0 && (
            <button
              onClick={() => navigate(`/${userType}/posts/${post.id}`)}
              className="text-sm font-semibold hover:text-pink-500 transition-colors border border-pink-300 px-2 py-1 rounded-full bg-pink-100 text-pink-500 flex items-center gap-1"
            >
              <Gift className="h-3.5 w-3.5" />
              {giftCount} {t("posts.gifts", { defaultValue: "gifts" })}
            </button>
          )}
        </div>

        {isActive && (
          <div className="flex items-center gap-1">
            <fetcher.Form ref={fulfillFormRef} method="post" action={`/${userType}/posts/${post.id}/fulfill`}>
              <button
                type="button"
                onClick={() => setConfirmAction("fulfill")}
                className="cursor-pointer flex items-center justify-center gap-2 p-1.5 text-green-500 hover:bg-green-50 rounded-md transition-colors"
              >
                <CheckCircle className="h-4 w-4" />
                <span className="text-sm">{t("posts.fulfill", { defaultValue: "Done" })}</span>
              </button>
            </fetcher.Form>
            <fetcher.Form ref={deleteFormRef} method="post" action={`/${userType}/posts/${post.id}/delete`}>
              <button
                type="button"
                onClick={() => setConfirmAction("delete")}
                className="cursor-pointer flex items-center justify-center gap-2 p-1.5 text-red-400 hover:bg-red-50 rounded-md transition-colors"
              >
                <Trash2 className="h-4 w-4" />
                <span className="text-sm">{t("posts.delete", { defaultValue: "Delete" })}</span>
              </button>
            </fetcher.Form>
          </div>
        )}
      </div>

      {/* Confirm Modal */}
      {confirmAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setConfirmAction(null)}>
          <div className="bg-white rounded-lg shadow-xl mx-4 w-full max-w-sm p-5" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-base font-semibold text-gray-900 mb-1">
              {confirmAction === "fulfill"
                ? t("posts.confirmFulfill", { defaultValue: "Mark this post as done?" })
                : t("posts.confirmDelete", { defaultValue: "Delete this post?" })}
            </h3>
            <p className="text-sm text-gray-500 mb-5">
              {confirmAction === "fulfill"
                ? t("posts.confirmFulfillDesc", { defaultValue: "This will close your post and stop showing it to others." })
                : t("posts.confirmDeleteDesc", { defaultValue: "This action cannot be undone." })}
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setConfirmAction(null)}
                className="px-4 py-2 text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
              >
                {t("posts.cancel", { defaultValue: "Cancel" })}
              </button>
              <button
                onClick={handleConfirm}
                className={`px-4 py-2 text-sm font-medium text-white rounded-md transition-colors ${
                  confirmAction === "fulfill"
                    ? "bg-green-500 hover:bg-green-600"
                    : "bg-red-500 hover:bg-red-600"
                }`}
              >
                {t("posts.confirm", { defaultValue: "Confirm" })}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
