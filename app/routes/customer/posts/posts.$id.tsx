import { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useLoaderData, useNavigate, useSearchParams, useFetcher, type LoaderFunctionArgs } from "react-router";
import { ArrowLeft, Calendar, Clock, Coins, MapPin, Users, Heart, MessageCircle, Gift, Send, Loader, X } from "lucide-react";

import { Badge } from "~/components/ui/badge";
import { requireUserSession } from "~/services/auths.server";
import { getPostById, getCustomerBasicProfile, getPostComments } from "~/services/post.server";
import PostComments from "~/components/posts/PostComments";
import { getActiveGifts } from "~/services/gift.server";
import { useSubscriptionCheck } from "~/hooks/useSubscriptionCheck";
import { SubscriptionModal } from "~/components/subscription/SubscriptionModal";
import { ChatAccessModal } from "~/components/ChatAccessModal";

export async function loader({ params, request }: LoaderFunctionArgs) {
  const customerId = await requireUserSession(request);
  const { hasActiveSubscription, hasPendingSubscription } = await import("~/services/package.server");
  const { prisma } = await import("~/services/database.server");

  const { getPostGifts } = await import("~/services/gift.server");

  const [post, customerProfile, hasSubscription, hasPending, trialPackage, wallet, postGifts, giftCatalog, comments] = await Promise.all([
    getPostById(params.id!),
    getCustomerBasicProfile(customerId),
    hasActiveSubscription(customerId),
    hasPendingSubscription(customerId),
    prisma.subscription_plan.findFirst({
      where: { name: "24-Hour Trial", status: "active" },
      select: { id: true, price: true },
    }),
    prisma.wallet.findFirst({
      where: { customerId },
      select: { totalBalance: true, totalSpend: true, totalRefunded: true },
    }),
    getPostGifts(params.id!),
    getActiveGifts(),
    getPostComments(params.id!),
  ]);

  if (!post) throw new Response("Post not found", { status: 404 });

  const availableBalance = (wallet?.totalBalance || 0) - (wallet?.totalSpend || 0) + (wallet?.totalRefunded || 0);

  return {
    post,
    customerId,
    customerProfile,
    hasActiveSubscription: hasSubscription,
    hasPendingSubscription: hasPending,
    trialPackage,
    customerBalance: availableBalance,
    postGifts,
    giftCatalog,
    comments,
  };
}

export default function PostDetailPage() {
  const { post, customerId, customerProfile, hasActiveSubscription, hasPendingSubscription, trialPackage, customerBalance, postGifts, giftCatalog, comments } = useLoaderData<typeof loader>();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const giftFetcher = useFetcher();
  const [searchParams, setSearchParams] = useSearchParams();
  const shouldShowSubscriptionFromUrl = searchParams.get("showSubscription") === "true";
  const [showGiftModal, setShowGiftModal] = useState(false);
  const [selectedGiftId, setSelectedGiftId] = useState<string | null>(null);
  const [localGifts, setLocalGifts] = useState(postGifts ?? []);
  const isSendingGift = giftFetcher.state !== "idle";

  useEffect(() => {
    if (giftFetcher.state === "idle" && giftFetcher.data) {
      const data = giftFetcher.data as any;
      if (data.success) {
        setShowGiftModal(false);
        setSelectedGiftId(null);
        // Add the new gift to the local list
        if (data.postGift) {
          setLocalGifts((prev: any[]) => [data.postGift, ...prev]);
        }
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

  const handleSendGift = () => {
    if (!selectedGiftId) return;
    giftFetcher.submit(
      { giftId: selectedGiftId },
      { method: "post", action: `/customer/posts/${post.id}/gift` }
    );
  };

  const {
    showSubscriptionModal,
    openSubscriptionModal,
    closeSubscriptionModal,
    handleSubscribe,
  } = useSubscriptionCheck({
    hasActiveSubscription,
    hasPendingSubscription,
    customerBalance,
    trialPrice: trialPackage?.price || 10000,
    trialPlanId: trialPackage?.id || "",
    showOnMount: shouldShowSubscriptionFromUrl,
  });

  const author = post.authorType === "customer" ? post.customer : post.model;
  const authorName = author ? `${author.firstName} ${author.lastName || ""}`.trim() : "User";
  const serviceName = post.service?.name
    ? t(`modelServices.serviceItems.${post.service.name}.name`, { defaultValue: post.service.name })
    : null;

  const customerName = customerProfile
    ? `${customerProfile.firstName} ${customerProfile.lastName || ""}`.trim()
    : "";

  // Chat access check
  const [chatModalState, setChatModalState] = useState<{ modelId: string; reason: string; whatsappNumber?: number } | null>(null);
  const chatCheckFetcher = useFetcher();
  const pendingChatRef = useRef<{ modelName: string; whatsapp: number; modelId: string } | null>(null);

  const handleChat = (modelName: string, whatsapp: number, modelId?: string) => {
    const targetModelId = modelId || post.modelId;
    if (!targetModelId) return;
    pendingChatRef.current = { modelName, whatsapp, modelId: targetModelId };
    chatCheckFetcher.load(`/customer/check-booking?modelId=${targetModelId}`);
  };

  useEffect(() => {
    if (chatCheckFetcher.state === "idle" && chatCheckFetcher.data && pendingChatRef.current) {
      const { modelName, whatsapp, modelId } = pendingChatRef.current;
      pendingChatRef.current = null;
      const data = chatCheckFetcher.data as any;
      if (data.canChat) {
        const message = t("posts.customerChatMessage", {
          modelName,
          customerName,
          defaultValue: `Hi {{modelName}}.\nI'm {{customerName}}, I see your post and I'm interested. Are you still available? I'd like to book you.`,
        });
        window.open(`https://wa.me/${whatsapp}?text=${encodeURIComponent(message)}`, "_blank");
      } else {
        setChatModalState({ modelId, reason: data.reason, whatsappNumber: whatsapp });
      }
    }
  }, [chatCheckFetcher.state, chatCheckFetcher.data]);

  return (
    <div className="p-4 max-w-2xl mx-auto">
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-2 text-sm text-gray-500 hover:text-rose-500 mb-4"
      >
        <ArrowLeft className="h-4 w-4" />
        {t("posts.backToPosts", { defaultValue: "Back to Posts" })}
      </button>

      <div className="p-2 border border-rose-300 rounded-md bg-rose-50">
        <div className="flex items-center gap-3 mb-3">
          {author?.profile ? (
            <img src={author.profile} alt={authorName} className="w-12 h-12 rounded-full object-cover border" />
          ) : (
            <div className="w-12 h-12 rounded-full bg-rose-100 flex items-center justify-center">
              <Users className="h-6 w-6 text-rose-400" />
            </div>
          )}
          <div>
            <p className="font-medium">{authorName}</p>
            <p className="text-xs text-gray-400">{new Date(post.createdAt).toLocaleString()}</p>
          </div>
          <div className="ml-auto flex items-center gap-1.5">
            {post.hasTip && (
              <Badge variant="outline" className="text-xs border-amber-200 text-amber-600 bg-amber-50 flex items-center gap-1">
                <Coins className="h-3 w-3" />
                {t("tipBadge", { defaultValue: "+Tip" })}
              </Badge>
            )}
            {serviceName && (
              <Badge variant="outline" className="text-xs border-rose-200 text-rose-600">{serviceName}</Badge>
            )}
          </div>
        </div>

        <p className="text-sm text-gray-800 whitespace-pre-wrap mb-3">{post.content}</p>

        <div className="flex flex-wrap gap-3 text-xs text-gray-500">
          {post.preferredDate && (
            <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{new Date(post.preferredDate).toLocaleDateString()}</span>
          )}
          {post.preferredTime && (
            <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{post.preferredTime}</span>
          )}
          {post.location && (
            <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{post.location}</span>
          )}
        </div>
      </div>

      {post.customer?.id === customerId && (
        <>
          <h2 className="text-sm font-bold mb-3 flex items-center gap-1 mt-4">
            <Heart className="h-4 w-4 text-rose-500 fill-rose-500" />
            {t("posts.interestedPeople", { defaultValue: "People Interested" })} ({post.interests.length})
          </h2>

          {post.interests.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">
              {/* {t("posts.noInterest", { defaultValue: "No one has shown interest yet." })} */}
            </p>
          ) : (
            <div className="space-y-2">
              {post.interests.map((interest) => {
                const user = interest.userType === "customer" ? interest.customer : interest.model;
                if (!user) return null;
                const userName = `${user.firstName} ${user.lastName || ""}`.trim();
                const profileUrl = interest.userType === "model"
                  ? `/customer/user-profile/${user.id}`
                  : "#";

                return (
                  <div
                    key={interest.id}
                    className="flex items-center justify-between border border-gray-200 cursor-pointer hover:border-rose-200 transition-colors rounded-sm px-4"
                    onClick={() => profileUrl !== "#" && navigate(profileUrl)}
                  >
                    <div className="p-3 flex items-center gap-3">
                      {user.profile ? (
                        <img src={user.profile} alt="" className="w-10 h-10 rounded-full object-cover border" />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center">
                          <Users className="h-5 w-5 text-gray-400" />
                        </div>
                      )}
                      <div className="flex-1">
                        <p className="text-sm font-medium">{userName}</p>
                        <p className="text-xs text-gray-400">{new Date(interest.createdAt).toLocaleString()}</p>
                      </div>
                    </div>
                    {user.whatsapp && (
                      <button
                        className="cursor-pointer text-gray-500 flex items-center justify-center gap-1 px-2 py-1 hover:opacity-60 transition-opacity text-sm border border-green-300 bg-green-50 text-green-500 rounded-md"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleChat(userName, user.whatsapp!, interest.userType === "model" ? user.id : undefined);
                        }}
                      >
                        <MessageCircle className="h-3.5 w-3.5" /> {t("posts.chat", { defaultValue: "Chat" })}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}


      {/* Gifts Sent Section */}
      {localGifts.length > 0 && (
        <>
          <div className="w-full flex items-center justify-between">
            <h2 className="text-sm font-bold mb-3 flex items-center gap-1 mt-4">
              <Gift className="h-4 w-4 text-rose-500" />
              {t("posts.giftsSent", { defaultValue: "Gifts" })} ({localGifts.length})
            </h2>
            {/* Send Gift Button */}
            {post.authorType === "model" && giftCatalog.length > 0 && (
              <div className="mt-4">
                <button
                  onClick={() => setShowGiftModal(true)}
                  className="w-full flex items-center justify-center gap-2 px-2.5 py-1.5 rounded-lg text-sm font-semibold bg-rose-500 hover:bg-rose-600 text-white transition-colors"
                >
                  <Gift className="h-4 w-4" />
                  {t("posts.sendMoreGift", { defaultValue: "ສົ່ງຂອງຂວັນອີກ" })}
                </button>
              </div>
            )}
          </div>
          <div className="grid grid-cols-3 gap-2 mt-4">
            {localGifts.map((pg: any) => (
              <div key={pg.id} className="border border-gray-100 rounded-lg p-3 flex flex-col items-center text-center bg-gray-50">
                {pg.gift?.image ? (
                  <img src={pg.gift.image} alt={pg.gift.name} className="w-12 h-12 object-contain mb-1.5" />
                ) : (
                  <Gift className="w-12 h-12 text-pink-400 mb-1.5" />
                )}
                <span className="text-xs font-medium text-gray-700 truncate w-full">{pg.gift?.name}</span>
                <span className="text-[10px] text-amber-600 font-semibold">{pg.gift?.price?.toLocaleString()} ₭</span>
                {pg.reaction && (
                  <span className="text-sm mt-1">
                    {pg.reaction === "love" ? "❤️" : pg.reaction === "care" ? "🥰" : "🙏"}
                  </span>
                )}
              </div>
            ))}
          </div>
        </>
      )}

      {/* Comments Section */}
      <PostComments
        comments={comments ?? []}
        postId={post.id}
        actionUrl={`/customer/posts/${post.id}/comment`}
        currentUserProfile={customerProfile}
      />

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
                  {t("posts.walletBalance", { defaultValue: "Balance" })}: {customerBalance.toLocaleString()} ₭
                </p>
              </div>
              <button onClick={() => { setShowGiftModal(false); setSelectedGiftId(null); }} className="text-gray-400 hover:text-gray-600">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-4 overflow-y-auto max-h-[50vh]">
              <div className="grid grid-cols-3 gap-3">
                {giftCatalog.map((gift: any) => {
                  const canAfford = customerBalance >= gift.price;
                  const isSelected = selectedGiftId === gift.id;
                  return (
                    <button
                      key={gift.id}
                      disabled={!canAfford || isSendingGift}
                      onClick={() => setSelectedGiftId(isSelected ? null : gift.id)}
                      className={`flex flex-col items-center gap-2 p-3 rounded-lg border-2 transition-all ${isSelected
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
                className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-all ${selectedGiftId && !isSendingGift
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

      {trialPackage && (
        <SubscriptionModal
          isOpen={showSubscriptionModal}
          onClose={closeSubscriptionModal}
          customerBalance={customerBalance}
          trialPrice={trialPackage.price}
          trialPlanId={trialPackage.id}
          onSubscribe={handleSubscribe}
        />
      )}

      {/* Chat Access Modal */}
      <ChatAccessModal
        isOpen={!!chatModalState}
        onClose={() => setChatModalState(null)}
        modelId={chatModalState?.modelId || ""}
        reason={chatModalState?.reason || ""}
        whatsappNumber={chatModalState?.whatsappNumber}
        onGiftSent={() => {
          setChatModalState(null);
          if (pendingChatRef.current) {
            const { modelId } = pendingChatRef.current;
            chatCheckFetcher.load(`/customer/check-booking?modelId=${modelId}`);
          }
        }}
      />

    </div>
  );
}
