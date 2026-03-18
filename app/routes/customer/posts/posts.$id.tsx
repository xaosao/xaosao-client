import { useTranslation } from "react-i18next";
import { useLoaderData, useNavigate, useSearchParams, type LoaderFunctionArgs } from "react-router";
import { ArrowLeft, Calendar, Clock, Coins, MapPin, Users, Heart, MessageCircle, Gift } from "lucide-react";

import { Badge } from "~/components/ui/badge";
import { requireUserSession } from "~/services/auths.server";
import { getPostById, getCustomerBasicProfile } from "~/services/post.server";
import { useSubscriptionCheck } from "~/hooks/useSubscriptionCheck";
import { SubscriptionModal } from "~/components/subscription/SubscriptionModal";

export async function loader({ params, request }: LoaderFunctionArgs) {
  const customerId = await requireUserSession(request);
  const { hasActiveSubscription, hasPendingSubscription } = await import("~/services/package.server");
  const { prisma } = await import("~/services/database.server");

  const { getPostGifts } = await import("~/services/gift.server");

  const [post, customerProfile, hasSubscription, hasPending, trialPackage, wallet, postGifts] = await Promise.all([
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
  };
}

export default function PostDetailPage() {
  const { post, customerId, customerProfile, hasActiveSubscription, hasPendingSubscription, trialPackage, customerBalance, postGifts } = useLoaderData<typeof loader>();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const shouldShowSubscriptionFromUrl = searchParams.get("showSubscription") === "true";

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

  const handleChat = (modelName: string, whatsapp: number) => {
    if (!hasActiveSubscription) {
      openSubscriptionModal();
      return;
    }
    const message = t("posts.customerChatMessage", {
      modelName,
      customerName,
      defaultValue: `Hi {{modelName}}.\nI'm {{customerName}}, I see your post and I'm interested. Are you still available? I'd like to book you.`,
    });
    window.open(`https://wa.me/${whatsapp}?text=${encodeURIComponent(message)}`, "_blank");
  };

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
              {t("posts.noInterest", { defaultValue: "No one has shown interest yet." })}
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
                          handleChat(userName, user.whatsapp!);
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
      {postGifts && postGifts.length > 0 && (
        <>
          <h2 className="text-sm font-bold mb-3 flex items-center gap-1 mt-4">
            <Gift className="h-4 w-4 text-pink-500" />
            {t("posts.giftsSent", { defaultValue: "Gifts" })} ({postGifts.length})
          </h2>
          <div className="space-y-2">
            {postGifts.map((pg: any) => {
              const sender = pg.customer;
              const senderName = sender ? `${sender.firstName} ${sender.lastName || ""}`.trim() : "Customer";
              return (
                <div key={pg.id} className="flex items-center gap-3 border border-gray-200 rounded-sm px-4 py-2">
                  {sender?.profile ? (
                    <img src={sender.profile} alt="" className="w-8 h-8 rounded-full object-cover" />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-pink-100 flex items-center justify-center">
                      <span className="text-xs font-semibold text-pink-500">{senderName.charAt(0)}</span>
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{senderName}</p>
                    <p className="text-xs text-gray-400">{new Date(pg.createdAt).toLocaleString()}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {pg.gift?.image ? (
                      <img src={pg.gift.image} alt={pg.gift.name} className="w-7 h-7 object-contain" />
                    ) : (
                      <Gift className="w-5 h-5 text-pink-400" />
                    )}
                    <span className="text-xs text-gray-500">{pg.gift?.name}</span>
                    {pg.reaction && (
                      <span className="text-xs px-1.5 py-0.5 rounded-full bg-pink-50 text-pink-500">
                        {pg.reaction === "love" ? "❤️" : pg.reaction === "care" ? "🥰" : "🙏"}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </>
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
    </div>
  );
}
