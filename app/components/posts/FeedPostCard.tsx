import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useFetcher, useNavigate, useSearchParams } from "react-router";
import { Heart, MessageCircle, Loader, CalendarCheck, Coins, Gift, X, Send } from "lucide-react";

import { calculateAgeFromDOB, getTimeAgo } from "~/utils";
import type { PostItem, UserProfile, GiftItem } from "~/types/post";
import PostImageGallery from "~/components/posts/PostImageGallery";

interface FeedPostCardProps {
  post: PostItem;
  customerProfile?: UserProfile | null;
  gifts?: GiftItem[];
  walletBalance?: number;
}

export default function FeedPostCard({ post, customerProfile, gifts = [], walletBalance = 0 }: FeedPostCardProps) {
  const { t } = useTranslation();
  const fetcher = useFetcher();
  const giftFetcher = useFetcher();
  const navigate = useNavigate();
  const [showGiftModal, setShowGiftModal] = useState(false);
  const [selectedGiftId, setSelectedGiftId] = useState<string | null>(null);
  const [, setSearchParams] = useSearchParams();

  const isToggling = fetcher.state !== "idle";
  const isSendingGift = giftFetcher.state !== "idle";

  // Handle gift send response
  useEffect(() => {
    if (giftFetcher.state === "idle" && giftFetcher.data) {
      const data = giftFetcher.data as any;
      if (data.success) {
        setShowGiftModal(false);
        setSelectedGiftId(null);
        setSearchParams((prev) => {
          prev.set("toastMessage", "posts.giftSentSuccess");
          prev.set("toastType", "success");
          return prev;
        }, { replace: true });
      } else if (data.error) {
        setSearchParams((prev) => {
          prev.set("toastMessage", data.error);
          prev.set("toastType", "error");
          return prev;
        }, { replace: true });
      }
    }
  }, [giftFetcher.state, giftFetcher.data]);
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

  // Only show gift button on model posts
  const isModelPost = post.authorType === "model";

  const handleChat = () => {
    if (!author?.whatsapp) return;
    const message = t("posts.customerChatMessage", {
      modelName: authorName,
      customerName,
      defaultValue: `Hi, ${authorName}.\nI'm ${customerName}, I see your post looking for a partner to hang out tonight.\nAre you still available? I'll book you.`,
    });
    window.open(`https://wa.me/${author.whatsapp}?text=${encodeURIComponent(message)}`, "_blank");
  };

  const handleSendGift = () => {
    if (!selectedGiftId) return;
    giftFetcher.submit(
      { giftId: selectedGiftId },
      { method: "post", action: `/customer/posts/${post.id}/gift` }
    );
  };

  return (
    <div className={`rounded-sm bg-white ${!hasImages ? "pb-2" : ""} ${post.hasTip ? "sm:border-transparent border border-yellow-300" : ""}`}>
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
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {post.hasTip && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-600 flex items-center gap-1">
              <Coins className="h-3 w-3" />
              {t("tipBadge", { defaultValue: "+Tip" })}
            </span>
          )}
          <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-600">
            {t("posts.stillAvailable", { defaultValue: "Available" })}
          </span>
        </div>
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

          {/* Gift - only for model posts */}
          {isModelPost && gifts.length > 0 && (
            <button
              className="cursor-pointer flex items-center gap-1 p-2 hover:opacity-60 transition-opacity text-gray-500"
              onClick={() => setShowGiftModal(true)}
              disabled={isSendingGift}
            >
              {isSendingGift ? (
                <Loader className="h-4 w-4 animate-spin text-pink-400" />
              ) : (
                <Gift className="h-4 w-4 text-pink-500" />
              )}
              <span className="text-sm">{t("posts.gift", { defaultValue: "Gift" })}</span>
            </button>
          )}

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

      {/* Gift Modal */}
      {showGiftModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center" onClick={() => { setShowGiftModal(false); setSelectedGiftId(null); }}>
          <div
            className="bg-white w-full sm:max-w-sm sm:rounded-lg rounded-t-2xl max-h-[70vh] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b">
              <div>
                <h3 className="text-sm font-semibold">{t("posts.sendGift", { defaultValue: "Send a Gift" })}</h3>
                <p className="text-xs text-gray-400">
                  {t("posts.walletBalance", { defaultValue: "Balance" })}: {walletBalance.toLocaleString()} ₭
                </p>
              </div>
              <button onClick={() => { setShowGiftModal(false); setSelectedGiftId(null); }} className="text-gray-400 hover:text-gray-600">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-4 overflow-y-auto max-h-[50vh]">
              <div className="grid grid-cols-3 gap-3">
                {gifts.map((gift) => {
                  const canAfford = walletBalance >= gift.price;
                  const isSelected = selectedGiftId === gift.id;
                  return (
                    <button
                      key={gift.id}
                      disabled={!canAfford || isSendingGift}
                      onClick={() => setSelectedGiftId(isSelected ? null : gift.id)}
                      className={`flex flex-col items-center gap-2 p-3 rounded-lg border-2 transition-all ${
                        isSelected
                          ? "border-pink-500 bg-pink-50 scale-[1.02]"
                          : canAfford
                            ? "border-gray-200 hover:border-pink-300 hover:bg-pink-50"
                            : "border-gray-100 opacity-50 cursor-not-allowed"
                      }`}
                    >
                      {gift.image ? (
                        <img src={gift.image} alt={gift.name} className="w-10 h-10 object-contain" />
                      ) : (
                        <Gift className="w-10 h-10 text-pink-400" />
                      )}
                      <span className="text-xs font-medium truncate w-full text-center">{gift.name}</span>
                      <span className="text-xs text-gray-500">{gift.price.toLocaleString()} ₭</span>
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="px-4 py-3 border-t">
              <button
                disabled={!selectedGiftId || isSendingGift}
                onClick={handleSendGift}
                className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                  selectedGiftId && !isSendingGift
                    ? "bg-pink-500 hover:bg-pink-600 text-white active:scale-[0.98]"
                    : "bg-gray-200 text-gray-400 cursor-not-allowed"
                }`}
              >
                {isSendingGift ? (
                  <Loader className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                {isSendingGift
                  ? t("posts.sending", { defaultValue: "Sending..." })
                  : t("posts.sendGift", { defaultValue: "Send a Gift" })}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
