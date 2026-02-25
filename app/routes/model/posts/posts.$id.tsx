import { useTranslation } from "react-i18next";
import { useLoaderData, useNavigate, type LoaderFunctionArgs } from "react-router";
import { ArrowLeft, Calendar, Clock, MapPin, Users, Heart, MessageCircle } from "lucide-react";

import { Badge } from "~/components/ui/badge";
import { getPostById, getModelBasicProfile } from "~/services/post.server";
import { requireModelSession } from "~/services/model-auth.server";

export async function loader({ params, request }: LoaderFunctionArgs) {
  const modelId = await requireModelSession(request);
  const [post, modelProfile] = await Promise.all([
    getPostById(params.id!),
    getModelBasicProfile(modelId),
  ]);
  if (!post) throw new Response("Post not found", { status: 404 });
  return { post, modelProfile };
}

export default function ModelPostDetailPage() {
  const { post, modelProfile } = useLoaderData<typeof loader>();
  const { t } = useTranslation();
  const navigate = useNavigate();

  const author = post.authorType === "customer" ? post.customer : post.model;
  const authorName = author ? `${author.firstName} ${author.lastName || ""}`.trim() : "User";
  const serviceName = post.service?.name
    ? t(`modelServices.serviceItems.${post.service.name}.name`, { defaultValue: post.service.name })
    : null;

  const modelName = modelProfile
    ? `${modelProfile.firstName} ${modelProfile.lastName || ""}`.trim()
    : "";
  const profileLink = modelProfile?.id
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/customer/model-profile/${modelProfile.id}`
    : "";

  const handleChat = (customerName: string, whatsapp: number) => {
    const message = t("posts.chatMessageDetail", {
      customerName,
      modelName,
      link: profileLink,
      defaultValue: `Hi, ${customerName}.\nI'm ${modelName}, ready to be your companion for the day and service you want.\nPlease booking at: ${profileLink}`,
    });
    window.open(`https://wa.me/${whatsapp}?text=${encodeURIComponent(message)}`, "_blank");
  };

  return (
    <div className="p-4 max-w-2xl mx-auto">
      <button
        onClick={() => navigate("/model/posts?tab=myPosts")}
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
          {serviceName && (
            <Badge variant="outline" className="ml-auto text-xs border-rose-200 text-rose-600">{serviceName}</Badge>
          )}
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
    </div>
  );
}
