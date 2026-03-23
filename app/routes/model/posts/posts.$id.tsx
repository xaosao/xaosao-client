import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useLoaderData, useNavigate, useFetcher, type LoaderFunctionArgs } from "react-router";
import { ArrowLeft, Calendar, Clock, Coins, MapPin, Users, Heart, MessageCircle, Gift, X, Eye } from "lucide-react";

import { Badge } from "~/components/ui/badge";
import { getPostById, getModelBasicProfile, getPostComments } from "~/services/post.server";
import PostComments from "~/components/posts/PostComments";
import { requireModelSession } from "~/services/model-auth.server";

export async function loader({ params, request }: LoaderFunctionArgs) {
  const modelId = await requireModelSession(request);
  const { getPostGifts } = await import("~/services/gift.server");

  const { getActiveGifts } = await import("~/services/gift.server");

  const [post, modelProfile, postGifts, giftCatalog, comments] = await Promise.all([
    getPostById(params.id!),
    getModelBasicProfile(modelId),
    getPostGifts(params.id!),
    getActiveGifts(),
    getPostComments(params.id!),
  ]);
  if (!post) throw new Response("Post not found", { status: 404 });
  return { post, modelId, modelProfile, postGifts, giftCatalog, comments };
}

export async function action({ params, request }: LoaderFunctionArgs) {
  const modelId = await requireModelSession(request);
  const formData = await request.formData();
  const postGiftId = formData.get("postGiftId") as string;
  const reaction = formData.get("reaction") as string;

  try {
    const { reactToGift } = await import("~/services/gift.server");
    await reactToGift(postGiftId, modelId, reaction);
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error?.message || "Failed to react" };
  }
}

export default function ModelPostDetailPage() {
  const { post, modelId, modelProfile, postGifts, giftCatalog, comments } = useLoaderData<typeof loader>();
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const reactionFetcher = useFetcher();
  const [showGiftCatalog, setShowGiftCatalog] = useState(false);

  const author = post.authorType === "customer" ? post.customer : post.model;
  const authorName = author ? `${author.firstName} ${author.lastName || ""}`.trim() : "User";
  const serviceName = post.service?.name
    ? t(`modelServices.serviceItems.${post.service.name}.name`, { defaultValue: post.service.name })
    : null;

  const modelName = modelProfile
    ? `${modelProfile.firstName} ${modelProfile.lastName || ""}`.trim()
    : "";
  const profileLink = modelProfile?.id
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/customer/user-profile/${modelProfile.id}`
    : "";

  const handleChat = (customerName: string, whatsapp: number) => {
    const message = t("posts.chatMessageDetail", {
      customerName,
      modelName,
      link: profileLink,
      defaultValue: `Hi {{customerName}}. Interested in booking me as your drinking companion?\nI'm still available! Book me at: ${profileLink}`,
    });
    window.open(`https://wa.me/${whatsapp}?text=${encodeURIComponent(message)}`, "_blank");
  };

  // Locale-based gift thank you messages
  const giftThankYouMessages: Record<string, string> = {
    en: `Thank you so much, {{customerName}}, for the gift.\nIf you're interested, feel free to book me as your drinking companion. My name on the app is: ${modelName}.`,
    lo: `ຂອບໃຈຫຼາຍໆເດີ, {{customerName}} ສໍາລັບຂອງຂວັນ.\nຖ້າອ້າຍສົນໃຈນ້ອງຈອງໄດ້ເດີຈະເປັນຄູ່ດື່ມໃຫ້, ຊື່ນ້ອງໃນແອັບແມ່ນ: ${modelName}.`,
    th: `ขอบคุณมากๆ นะคะ {{customerName}} สำหรับของขวัญ\nถ้าพี่สนใจจองน้องได้เลยนะคะ จะเป็นคู่ดื่มให้ ชื่อน้องในแอปคือ: ${modelName}`,
  };

  const handleGiftChat = (customerName: string, whatsapp: number) => {
    const template = giftThankYouMessages[i18n.language] || giftThankYouMessages["en"];
    const message = template.replace("{{customerName}}", customerName);
    window.open(`https://wa.me/${whatsapp}?text=${encodeURIComponent(message)}`, "_blank");
  };

  return (
    <div className="p-4 max-w-2xl mx-auto">
      <button
        onClick={() => navigate("/model?tab=myPosts")}
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

      {post.model?.id === modelId && (
        <>
          <h2 className="text-sm font-bold mb-3 flex items-center gap-2 mt-4">
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
                const profileUrl = interest.userType === "customer"
                  ? `/model/customer-profile/${user.id}`
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

      {/* Gifts Received Section - model can react */}
      {post.model?.id === modelId && postGifts && postGifts.length > 0 && (
        <>
          <div className="flex items-center justify-between mt-4 mb-3">
            <h2 className="text-sm font-bold flex items-center gap-2">
              <Gift className="h-4 w-4 text-rose-500" />
              {t("posts.giftsReceived", { defaultValue: "ຂອງຂວັນທີ່ໄດ້ຮັບ" })} ({postGifts.length})
            </h2>
            {giftCatalog.length > 0 && (
              <button
                onClick={() => setShowGiftCatalog(true)}
                className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-rose-500 border border-rose-200 bg-rose-50 rounded-md hover:bg-rose-100 transition-colors"
              >
                <Eye className="h-3 w-3" />
                {t("posts.viewGiftTypes", { defaultValue: "ເບິ່ງປະເພດຂອງຂວັນທັງໝົດ" })}
              </button>
            )}
          </div>
          <div className="grid grid-cols-3 gap-2">
            {postGifts.map((pg: any) => {
              const currentReaction = reactionFetcher.formData?.get("postGiftId") === pg.id
                ? reactionFetcher.formData?.get("reaction") as string
                : pg.reaction;

              return (
                <div key={pg.id} className="border border-gray-100 rounded-lg p-3 flex flex-col items-center text-center bg-gray-50">
                  {pg.gift?.image ? (
                    <img src={pg.gift.image} alt={pg.gift.name} className="w-12 h-12 object-contain mb-1.5" />
                  ) : (
                    <Gift className="w-12 h-12 text-pink-400 mb-1.5" />
                  )}
                  <span className="text-xs font-medium text-gray-700 truncate w-full">{pg.gift?.name}</span>
                  <span className="text-[10px] text-amber-600 font-semibold">{pg.gift?.price?.toLocaleString()} ₭</span>
                  <div className="flex items-center gap-0.5 mt-1.5">
                    {["love", "care", "thankyou"].map((r) => (
                      <button
                        key={r}
                        onClick={() => {
                          reactionFetcher.submit(
                            { postGiftId: pg.id, reaction: r },
                            { method: "post" }
                          );
                        }}
                        className={`text-sm px-1 rounded transition-all ${currentReaction === r
                            ? "bg-pink-100 scale-110"
                            : "hover:bg-gray-100 opacity-50 hover:opacity-100"
                          }`}
                      >
                        {r === "love" ? "❤️" : r === "care" ? "🥰" : "🙏"}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Comments Section */}
      <PostComments
        comments={comments ?? []}
        postId={post.id}
        actionUrl={`/model/posts/${post.id}/comment`}
        currentUserProfile={modelProfile}
      />

      {/* Gift Catalog Modal */}
      {showGiftCatalog && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center" onClick={() => setShowGiftCatalog(false)}>
          <div
            className="bg-white w-full sm:max-w-sm sm:rounded-lg rounded-t-2xl max-h-[70vh] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <Gift className="h-4 w-4 text-rose-500" />
                {t("posts.allGiftTypes", { defaultValue: "ຂອງຂວັນທັງໝົດ" })}
              </h3>
              <button onClick={() => setShowGiftCatalog(false)} className="text-gray-400 hover:text-gray-600">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-4 overflow-y-auto max-h-[55vh]">
              <div className="grid grid-cols-3 gap-3">
                {giftCatalog.map((gift: any) => (
                  <div
                    key={gift.id}
                    className="flex flex-col items-center gap-2 p-3 rounded-lg border border-gray-200 bg-gray-50"
                  >
                    {gift.image ? (
                      <img src={gift.image} alt={gift.name} className="w-12 h-12 object-contain" />
                    ) : (
                      <Gift className="w-12 h-12 text-pink-400" />
                    )}
                    <span className="text-xs font-medium truncate w-full text-center">{gift.name}</span>
                    <span className="text-xs font-semibold text-amber-600">{gift.price.toLocaleString()} ₭</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
