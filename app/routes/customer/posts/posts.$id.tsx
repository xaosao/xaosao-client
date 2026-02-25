import { useTranslation } from "react-i18next";
import { useLoaderData, useNavigate, type LoaderFunctionArgs } from "react-router";
import { ArrowLeft, Calendar, Clock, MapPin, Users, Heart } from "lucide-react";

import { Badge } from "~/components/ui/badge";
import { Card, CardContent } from "~/components/ui/card";
import { requireUserSession } from "~/services/auths.server";
import { getPostById } from "~/services/post.server";
import { calculateAgeFromDOB } from "~/utils";

export async function loader({ params, request }: LoaderFunctionArgs) {
  await requireUserSession(request);
  const post = await getPostById(params.id!);
  if (!post) throw new Response("Post not found", { status: 404 });
  return { post };
}

export default function PostDetailPage() {
  const { post } = useLoaderData<typeof loader>();
  const { t } = useTranslation();
  const navigate = useNavigate();

  const author = post.authorType === "customer" ? post.customer : post.model;
  const authorName = author ? `${author.firstName} ${author.lastName || ""}`.trim() : "User";
  const serviceName = post.service?.name
    ? t(`modelServices.serviceItems.${post.service.name}.name`, { defaultValue: post.service.name })
    : null;

  return (
    <div className="p-4 max-w-2xl mx-auto">
      <button
        onClick={() => navigate("/customer/posts")}
        className="flex items-center gap-2 text-sm text-gray-500 hover:text-rose-500 mb-4"
      >
        <ArrowLeft className="h-4 w-4" />
        {t("posts.backToPosts", { defaultValue: "Back to Posts" })}
      </button>

      {/* Post content */}
      <Card className="mb-4">
        <CardContent className="p-4">
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
        </CardContent>
      </Card>

      {/* Interested users */}
      <h2 className="text-sm font-bold mb-3 flex items-center gap-2">
        <Heart className="h-4 w-4 text-rose-500" />
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
            const age = (user as any).dob ? calculateAgeFromDOB((user as any).dob) : null;
            const profileUrl = interest.userType === "model"
              ? `/customer/model-profile/${user.id}`
              : "#";

            return (
              <Card
                key={interest.id}
                className="cursor-pointer hover:border-rose-200 transition-colors"
                onClick={() => profileUrl !== "#" && navigate(profileUrl)}
              >
                <CardContent className="p-3 flex items-center gap-3">
                  {user.profile ? (
                    <img src={user.profile} alt="" className="w-10 h-10 rounded-full object-cover border" />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center">
                      <Users className="h-5 w-5 text-gray-400" />
                    </div>
                  )}
                  <div className="flex-1">
                    <p className="text-sm font-medium">
                      {user.firstName} {user.lastName || ""}
                      {age ? `, ${age}` : ""}
                    </p>
                    <p className="text-xs text-gray-400">{new Date(interest.createdAt).toLocaleString()}</p>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
