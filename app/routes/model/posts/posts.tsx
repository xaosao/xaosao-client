import { useState } from "react";
import { Plus, Users } from "lucide-react";
import { useTranslation } from "react-i18next";
import { type LoaderFunction, useSearchParams } from "react-router";

import { Button } from "~/components/ui/button";
import MyPostCard from "~/components/posts/MyPostCard";
import CustomerRequestCard from "~/components/posts/CustomerRequestCard";
import CreateModelPostModal from "~/components/posts/CreateModelPostModal";

import type { PostItem, UserProfile } from "~/types/post";
import { requireModelSession } from "~/services/model-auth.server";
import { getPostsFeed, getMyPosts, getModelBasicProfile } from "~/services/post.server";

interface LoaderReturn {
  feed: { posts: PostItem[]; total: number; page: number; totalPages: number };
  myPosts: { posts: PostItem[]; total: number };
  modelProfile: UserProfile | null;
}

interface PageProps {
  loaderData: LoaderReturn;
}

export const loader: LoaderFunction = async ({ request }) => {
  const modelId = await requireModelSession(request);
  const url = new URL(request.url);
  const serviceFilter = url.searchParams.get("service") || undefined;
  const page = parseInt(url.searchParams.get("page") || "1");

  const [feed, myPosts, modelProfile] = await Promise.all([
    getPostsFeed("model", modelId, { serviceId: serviceFilter, page }),
    getMyPosts(modelId, "model", 1, 50),
    getModelBasicProfile(modelId),
  ]);

  return { feed, myPosts, modelProfile };
};

export default function ModelPostsPage({ loaderData }: PageProps) {
  const { feed, myPosts, modelProfile } = loaderData;
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = (searchParams.get("tab") === "myPosts" ? "myPosts" : "feed") as "feed" | "myPosts";
  const setActiveTab = (tab: "feed" | "myPosts") => {
    setSearchParams((prev) => {
      if (tab === "feed") { prev.delete("tab"); } else { prev.set("tab", tab); }
      return prev;
    }, { replace: true });
  };
  const [showCreateModal, setShowCreateModal] = useState(false);

  return (
    <div className="pb-24 sm:pb-4 max-w-xl mx-auto">
      <div className="hidden sm:flex items-center justify-between px-4 py-3">
        <h1 className="text-lg font-bold">{t("posts.title", { defaultValue: "Posts" })}</h1>
        <Button
          size="sm"
          className="bg-rose-500 hover:bg-rose-600 text-white"
          onClick={() => setShowCreateModal(true)}
        >
          <Plus className="h-4 w-4 mr-1" />
          {t("posts.createAvailability", { defaultValue: "Post Availability" })}
        </Button>
      </div>

      <div className="flex border-b fixed left-0 right-0 top-[58px] sm:sticky sm:top-0 bg-white z-20 max-w-xl mx-auto">
        <button
          className={`flex-1 py-2.5 text-sm font-semibold text-center border-b-2 transition-colors ${activeTab === "feed"
            ? "border-rose-500 text-rose-500 text-bold bg-rose-50"
            : "border-transparent text-gray-400 hover:text-gray-600"
            }`}
          onClick={() => setActiveTab("feed")}
        >
          {t("posts.customerRequests", { defaultValue: "Customer Requests" })}
        </button>
        <button
          className={`flex-1 py-2.5 text-sm font-semibold text-center border-b-2 transition-colors ${activeTab === "myPosts"
            ? "border-rose-500 text-rose-500 text-bold bg-rose-50"
            : "border-transparent text-gray-400 hover:text-gray-600"
            }`}
          onClick={() => setActiveTab("myPosts")}
        >
          {t("posts.myPosts", { defaultValue: "My Posts" })} ({myPosts.total})
        </button>
      </div>

      <div className="h-[42px] sm:hidden" />

      {activeTab === "feed" && (
        <div className="divide-y divide-gray-100 space-y-2 sm:space-y-6 p-2 bg-gray-200 sm:bg-white">
          {feed.posts.length === 0 ? (
            <div className="text-center py-16 text-gray-500 px-4">
              <Users className="h-12 w-12 mx-auto mb-3 text-gray-200" />
              <p className="text-sm">{t("posts.emptyFeed", { defaultValue: "No posts yet. Check back later!" })}</p>
            </div>
          ) : (
            feed.posts.map((post) => (
              <CustomerRequestCard key={post.id} post={post} modelProfile={modelProfile} />
            ))
          )}
        </div>
      )}

      {activeTab === "myPosts" && (
        <div className="divide-y divide-gray-100 space-y-2 p-2 bg-gray-200 sm:bg-white">
          {myPosts.posts.length === 0 ? (
            <div className="text-center py-16 text-gray-500 px-4 border border-gray-500">
              <Plus className="h-12 w-12 mx-auto mb-3 text-gray-200" />
              <p className="text-sm">{t("posts.emptyMyPosts", { defaultValue: "You haven't created any posts yet." })}</p>
              <Button
                size="sm"
                variant="outline"
                className="mt-3"
                onClick={() => setShowCreateModal(true)}
              >
                {t("posts.createFirst", { defaultValue: "Create your first post" })}
              </Button>
            </div>
          ) : (
            myPosts.posts.map((post) => (
              <MyPostCard key={post.id} post={post} userType="model" userProfile={modelProfile} />
            ))
          )}
        </div>
      )}

      <button
        className="fixed bottom-20 right-4 z-30 sm:hidden w-auto h-auto py-2 px-4 rounded-full bg-rose-500 hover:bg-rose-600 text-white shadow-lg flex items-center justify-center active:scale-95 transition-transform"
        onClick={() => setShowCreateModal(true)}
      >
        <Plus className="h-4 w-4" /> Post
      </button>

      <CreateModelPostModal
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSuccess={() => {
          setShowCreateModal(false);
          setActiveTab("myPosts");
        }}
        modelProfile={modelProfile}
      />
    </div>
  );
}

