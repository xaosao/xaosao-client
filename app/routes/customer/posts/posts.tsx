import { useTranslation } from "react-i18next";
import { Loader, Plus, Users } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { type LoaderFunction, useFetcher, useSearchParams } from "react-router";

import { Button } from "~/components/ui/button";
import MyPostCard from "~/components/posts/MyPostCard";
import FeedPostCard from "~/components/posts/FeedPostCard";
import CreateCustomerPostModal from "~/components/posts/CreateCustomerPostModal";

import type { PostItem, UserProfile } from "~/types/post";
import { requireUserSession } from "~/services/auths.server";
import { hasActiveSubscription } from "~/services/package.server";
import { getPostsFeed, getMyPosts, getActiveServices, getCustomerBasicProfile } from "~/services/post.server";

interface LoaderReturn {
  feed: { posts: PostItem[]; total: number; page: number; totalPages: number };
  myPosts: { posts: PostItem[]; total: number; page: number; totalPages: number };
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

  const [feed, myPosts, services, hasSubscription, customerProfile] = await Promise.all([
    getPostsFeed("customer", customerId, { serviceId: serviceFilter, page: 1, limit: 20 }),
    getMyPosts(customerId, "customer", 1, 20),
    getActiveServices(),
    hasActiveSubscription(customerId),
    getCustomerBasicProfile(customerId),
  ]);

  return { feed, myPosts, services, hasSubscription, customerProfile };
};

export default function CustomerPostsPage({ loaderData }: PageProps) {
  const { feed, myPosts, services, customerProfile } = loaderData;
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

  // Swipe to change tab (mobile only)
  const touchStartX = useRef<number | null>(null);
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };
  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const diff = e.changedTouches[0].clientX - touchStartX.current;
    touchStartX.current = null;
    if (Math.abs(diff) < 50) return; // minimum swipe distance
    if (diff > 0 && activeTab === "myPosts") setActiveTab("feed");
    if (diff < 0 && activeTab === "feed") setActiveTab("myPosts");
  };

  // Feed infinite scroll state
  const [feedPosts, setFeedPosts] = useState<PostItem[]>(feed.posts);
  const [feedPage, setFeedPage] = useState(feed.page);
  const [feedHasMore, setFeedHasMore] = useState(feed.page < feed.totalPages);
  const feedSentinelRef = useRef<HTMLDivElement>(null);
  const feedFetcher = useFetcher<{ posts: PostItem[]; hasMore: boolean; page: number }>();

  // My Posts infinite scroll state
  const [myPostsList, setMyPostsList] = useState<PostItem[]>(myPosts.posts);
  const [myPostsPage, setMyPostsPage] = useState(myPosts.page);
  const [myPostsHasMore, setMyPostsHasMore] = useState(myPosts.page < myPosts.totalPages);
  const myPostsSentinelRef = useRef<HTMLDivElement>(null);
  const myPostsFetcher = useFetcher<{ posts: PostItem[]; hasMore: boolean; page: number; total: number }>();

  // Reset cached posts when loaderData changes (revalidation after create/delete/fulfill)
  useEffect(() => {
    setFeedPosts(feed.posts);
    setFeedPage(feed.page);
    setFeedHasMore(feed.page < feed.totalPages);
  }, [feed]);

  useEffect(() => {
    setMyPostsList(myPosts.posts);
    setMyPostsPage(myPosts.page);
    setMyPostsHasMore(myPosts.page < myPosts.totalPages);
  }, [myPosts]);

  // Handle feed fetcher response
  useEffect(() => {
    if (feedFetcher.state === "idle" && feedFetcher.data) {
      const { posts: newPosts, hasMore, page } = feedFetcher.data;
      setFeedPosts((prev) => [...prev, ...newPosts]);
      setFeedHasMore(hasMore);
      setFeedPage(page);
    }
  }, [feedFetcher.state, feedFetcher.data]);

  // Handle my posts fetcher response
  useEffect(() => {
    if (myPostsFetcher.state === "idle" && myPostsFetcher.data) {
      const { posts: newPosts, hasMore, page } = myPostsFetcher.data;
      setMyPostsList((prev) => [...prev, ...newPosts]);
      setMyPostsHasMore(hasMore);
      setMyPostsPage(page);
    }
  }, [myPostsFetcher.state, myPostsFetcher.data]);

  // Feed IntersectionObserver
  useEffect(() => {
    const sentinel = feedSentinelRef.current;
    if (!sentinel || !feedHasMore) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && feedHasMore && feedFetcher.state === "idle") {
          const nextPage = feedPage + 1;
          feedFetcher.load(`/customer/posts/load-more?type=feed&page=${nextPage}&limit=20`);
        }
      },
      { threshold: 0.1, rootMargin: "200px" }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [activeTab, feedHasMore, feedPage, feedFetcher.state]);

  // My Posts IntersectionObserver
  useEffect(() => {
    const sentinel = myPostsSentinelRef.current;
    if (!sentinel || !myPostsHasMore) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && myPostsHasMore && myPostsFetcher.state === "idle") {
          const nextPage = myPostsPage + 1;
          myPostsFetcher.load(`/customer/posts/load-more?type=myPosts&page=${nextPage}&limit=20`);
        }
      },
      { threshold: 0.1, rootMargin: "200px" }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [activeTab, myPostsHasMore, myPostsPage, myPostsFetcher.state]);

  const myPostsTotal = myPostsFetcher.data?.total ?? myPosts.total;

  return (
    <div className="pb-24 sm:pb-4 max-w-xl mx-auto">
      <div className="hidden sm:flex items-center justify-between px-4 py-3 pb-0 sm:pb-8">
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

      <div className="flex border-b fixed left-0 right-0 top-[65px] sm:sticky sm:top-0 bg-white z-20 max-w-xl mx-auto">
        <button
          className={`flex-1 py-2.5 text-sm font-semibold text-center border-b-2 transition-colors ${activeTab === "feed"
            ? "border-rose-500 text-rose-500 bg-rose-50"
            : "border-transparent text-gray-400 hover:text-gray-600"
            }`}
          onClick={() => setActiveTab("feed")}
        >
          {t("posts.feed", { defaultValue: "Feed" })}
        </button>
        <button
          className={`flex-1 py-2.5 text-sm font-semibold text-center border-b-2 transition-colors ${activeTab === "myPosts"
            ? "border-rose-500 text-rose-500 bg-rose-50"
            : "border-transparent text-gray-400 hover:text-gray-600"
            }`}
          onClick={() => setActiveTab("myPosts")}
        >
          {t("posts.myPosts", { defaultValue: "My Posts" })} ({myPostsTotal})
        </button>
      </div>

      <div className="h-[42px] sm:hidden" />

      <div onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
        {activeTab === "feed" && (
          <div className="divide-y divide-gray-100 space-y-2 sm:space-y-6 p-2 bg-gray-200 sm:bg-white">
            {feedPosts.length === 0 ? (
              <div className="text-center py-16 text-gray-500 px-4">
                <Users className="h-12 w-12 mx-auto mb-3 text-gray-200" />
                <p className="text-sm">{t("posts.emptyFeed", { defaultValue: "No posts yet. Check back later!" })}</p>
              </div>
            ) : (
              <>
                {feedPosts.map((post) => (
                  <FeedPostCard key={post.id} post={post} customerProfile={customerProfile} />
                ))}
                {feedHasMore && <div ref={feedSentinelRef} className="h-4 w-full" />}
                {feedFetcher.state !== "idle" && (
                  <div className="flex justify-center py-4">
                    <Loader className="h-5 w-5 animate-spin text-rose-400" />
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {activeTab === "myPosts" && (
          <div className="divide-y divide-gray-100 space-y-2 p-2 bg-gray-200 sm:bg-white">
            {myPostsList.length === 0 ? (
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
              <>
                {myPostsList.map((post) => (
                  <MyPostCard key={post.id} post={post} userType="customer" userProfile={customerProfile} />
                ))}
                {myPostsHasMore && <div ref={myPostsSentinelRef} className="h-4 w-full" />}
                {myPostsFetcher.state !== "idle" && (
                  <div className="flex justify-center py-4">
                    <Loader className="h-5 w-5 animate-spin text-rose-400" />
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>

      <button
        className="fixed bottom-20 right-4 z-30 sm:hidden w-auto h-auto py-2 px-4 rounded-full bg-rose-500 hover:bg-rose-600 text-white shadow-lg flex items-center justify-center active:scale-95 transition-transform"
        onClick={() => setShowCreateModal(true)}
      >
        <Plus className="h-4 w-4" />&nbsp;{t("posts.post", { defaultValue: "Post" })}
      </button>

      <CreateCustomerPostModal
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSuccess={() => {
          setShowCreateModal(false);
          setActiveTab("myPosts");
        }}
        services={services}
        customerProfile={customerProfile}
      />
    </div>
  );
}
