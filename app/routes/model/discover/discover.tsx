/**
 * Model-side Discover — models browsing customers.
 *
 * Restores the browse surface models lost when the Match page was removed,
 * in the new card-grid design. Four tabs, nearest-first, and the audience is
 * decided by the model's own gender (see app/utils/gender.ts) rather than by
 * a filter the user picks.
 */

import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { useLoaderData, useFetcher, useSearchParams } from "react-router";
import { useTranslation } from "react-i18next";
import { requireModelSession } from "~/services/model-auth.server";
import {
  DiscoverTabs,
  parseTab,
  type DiscoverTab,
} from "~/components/discover/DiscoverTabs";
import { ProfileGrid } from "~/components/discover/ProfileGrid";
import { useOptimisticLikes } from "~/hooks/useOptimisticLikes";
import { useInfiniteScroll } from "~/hooks/useInfiniteScroll";
import { useDiscoverPages } from "~/hooks/useDiscoverPages";
import { loadModelDiscover } from "~/services/discover.server";
import { HeaderSearch } from "~/components/discover/HeaderSearch";
import type { DiscoverProfile } from "~/components/discover/ProfileCard";
import { calculateAgeFromDOB } from "~/utils";

export async function loader({ request }: LoaderFunctionArgs) {
  const modelId = await requireModelSession(request);
  const tab = parseTab(new URL(request.url).searchParams.get("tab"));

  const { prisma } = await import("~/services/database.server");
  const me = await prisma.model.findUnique({
    where: { id: modelId },
    select: { latitude: true, longitude: true },
  });

  const { profiles, hasMore } = await loadModelDiscover(modelId, tab, 1, {
    lat: me?.latitude,
    lng: me?.longitude,
  });

  return {
    profiles,
    hasMore,
    hasLocation: !!(me?.latitude && me?.longitude),
  };
}

export async function action({ request }: ActionFunctionArgs) {
  const modelId = await requireModelSession(request);
  const formData = await request.formData();
  const customerId = String(formData.get("customerId") ?? "");
  const liked = formData.get("liked") === "true";

  if (!customerId) return { success: false };

  // Idempotent setter, not the toggle in model.server — and un-liking must
  // NOT write a PASS: passing hides the customer from Discover, which is not
  // what tapping the heart off means.
  const { setModelLike } = await import("~/services/interaction.server");
  const result = await setModelLike(modelId, customerId, liked);
  return { success: result.success, liked: result.liked, customerId };
}

export default function ModelDiscover() {
  const { profiles: firstPage, hasMore: firstHasMore, hasLocation } =
    useLoaderData<typeof loader>();
  const [searchParams] = useSearchParams();
  const tab = parseTab(searchParams.get("tab")) as DiscoverTab;
  const likeFetcher = useFetcher();
  const { t } = useTranslation();

  // Accumulate pages as the user scrolls; resets when the tab changes.
  const { profiles, loadingMore, hasMore, loadMore } = useDiscoverPages({
    firstPage,
    firstHasMore,
    endpoint: "/model/discover/load-more",
    tab,
  });
  const sentinelRef = useInfiniteScroll({
    enabled: hasMore && !loadingMore,
    onLoadMore: loadMore,
  });

  // Instant feedback on tap, held steady until the loader catches up.
  const optimistic = useOptimisticLikes(profiles, likeFetcher, "customerId");

  return (
    <div className="flex flex-col min-h-full bg-white">
      {/* Desktop puts the search field in the header itself, top-right.
          On mobile there is no room, so the icon next to the notification
          bell in the layout header opens it as a dropdown instead. */}
      <div className="flex items-start justify-between gap-4 px-4 pt-4 pb-2">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold" suppressHydrationWarning>
            {t("navigation.discover", { defaultValue: "Discover" })}
          </h1>
          <p className="text-xs text-gray-500" suppressHydrationWarning>
            {t("discover.subtitle", { defaultValue: "Find people near you" })}
          </p>
        </div>
        <div className="hidden sm:block shrink-0">
          <HeaderSearch
            variant="input"
            searchAction="/model/discover/search"
            hrefFor={(id) => `/model/customer-profile/${id}`}
          />
        </div>
      </div>

      <DiscoverTabs basePath="/model/discover" />

      {!hasLocation && tab !== "likeMe" && tab !== "iLike" && (
        <p className="px-4 py-2 text-xs text-amber-700 bg-amber-50 border-b border-amber-200">
          {t("discover.noLocation", {
            defaultValue:
              "Turn on location to sort people by how near they are.",
          })}
        </p>
      )}

      <ProfileGrid
        profiles={optimistic}
        hrefFor={(id) => `/model/customer-profile/${id}`}
        onToggleLike={(customerId, nextLiked) =>
          likeFetcher.submit(
            { customerId, liked: String(nextLiked) },
            { method: "post" }
          )
        }
        sentinelRef={sentinelRef}
        loadingMore={loadingMore}
        endReached={!hasMore}
      />
    </div>
  );
}
