import { useState } from "react";
import { useTranslation } from "react-i18next";
import { type LoaderFunction } from "react-router";
import { Plus, Users } from "lucide-react";

import { Button } from "~/components/ui/button";
import MyPostCard from "~/components/posts/MyPostCard";
import FeedPostCard from "~/components/posts/FeedPostCard";
import CreateCustomerPostModal from "~/components/posts/CreateCustomerPostModal";

import { requireUserSession } from "~/services/auths.server";
import { hasActiveSubscription } from "~/services/package.server";
import { getPostsFeed, getMyPosts, getActiveServices, getCustomerBasicProfile } from "~/services/post.server";
import type { PostItem, UserProfile } from "~/types/post";

interface LoaderReturn {
  feed: { posts: PostItem[]; total: number; page: number; totalPages: number };
  myPosts: { posts: PostItem[]; total: number };
  services: { id: string; name: string }[];
  hasSubscription: boolean;
  customerProfile: UserProfile | null;
}

interface PageProps {
  loaderData: LoaderReturn;
}

export const loader: LoaderFunction = async ({ request }) => {
  const customerId = await requireUserSession(request);
  const url = new URL(request.url);
  const serviceFilter = url.searchParams.get("service") || undefined;
  const page = parseInt(url.searchParams.get("page") || "1");

  const [feed, myPosts, services, hasSubscription, customerProfile] = await Promise.all([
    getPostsFeed("customer", customerId, { serviceId: serviceFilter, page }),
    getMyPosts(customerId, "customer", 1, 50),
    getActiveServices(),
    hasActiveSubscription(customerId),
    getCustomerBasicProfile(customerId),
  ]);

  return { feed, myPosts, services, hasSubscription, customerProfile };
};

export default function CustomerPostsPage({ loaderData }: PageProps) {
  const { feed, myPosts, services, hasSubscription, customerProfile } = loaderData;
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<"feed" | "myPosts">("feed");
  const [showCreateModal, setShowCreateModal] = useState(false);

  return (
    <div className="pb-24 sm:pb-4 max-w-xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3">
        <h1 className="text-lg font-bold">{t("posts.title", { defaultValue: "Posts" })}</h1>
        <Button
          size="sm"
          className="bg-rose-500 hover:bg-rose-600 text-white"
          onClick={() => setShowCreateModal(true)}
        >
          <Plus className="h-4 w-4 mr-1" />
          {t("posts.create", { defaultValue: "Create Post" })}
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex border-b">
        <button
          className={`flex-1 py-2.5 text-sm font-semibold text-center border-b-2 transition-colors ${
            activeTab === "feed"
              ? "border-gray-900 text-gray-900"
              : "border-transparent text-gray-400 hover:text-gray-600"
          }`}
          onClick={() => setActiveTab("feed")}
        >
          {t("posts.feed", { defaultValue: "Feed" })}
        </button>
        <button
          className={`flex-1 py-2.5 text-sm font-semibold text-center border-b-2 transition-colors ${
            activeTab === "myPosts"
              ? "border-gray-900 text-gray-900"
              : "border-transparent text-gray-400 hover:text-gray-600"
          }`}
          onClick={() => setActiveTab("myPosts")}
        >
          {t("posts.myPosts", { defaultValue: "My Posts" })} ({myPosts.total})
        </button>
      </div>

      {/* Feed Tab */}
      {activeTab === "feed" && (
        <div className="divide-y divide-gray-100">
          {feed.posts.length === 0 ? (
            <div className="text-center py-16 text-gray-500 px-4">
              <Users className="h-12 w-12 mx-auto mb-3 text-gray-200" />
              <p className="text-sm">{t("posts.emptyFeed", { defaultValue: "No posts yet. Check back later!" })}</p>
            </div>
          ) : (
            feed.posts.map((post) => (
              <FeedPostCard key={post.id} post={post} hasSubscription={hasSubscription} />
            ))
          )}
        </div>
      )}

      {/* My Posts Tab */}
      {activeTab === "myPosts" && (
        <div className="divide-y divide-gray-100">
          {myPosts.posts.length === 0 ? (
            <div className="text-center py-16 text-gray-500 px-4">
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
              <MyPostCard key={post.id} post={post} userType="customer" userProfile={customerProfile} />
            ))
          )}
        </div>
      )}

      {/* Create Post Modal */}
      <CreateCustomerPostModal
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSuccess={() => {
          setShowCreateModal(false);
          setActiveTab("myPosts");
        }}
        services={services}
      />
    </div>
  );
}

