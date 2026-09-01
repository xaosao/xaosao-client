/**
 * Customer Discover — the 2-column card grid.
 *
 * Replaces the previous multi-carousel page (preserved as
 * `discover.previous.tsx.bak`) with the design in the app: four tabs, nearest
 * first, and an audience decided by the viewer's own gender rather than by a
 * female/male tab they pick. See app/utils/gender.ts for that rule.
 */

import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { useFetcher, useLoaderData, useSearchParams } from "react-router";
import { useTranslation } from "react-i18next";
import { requireVerifiedUserSession } from "~/services/auths.server";
import {
  DiscoverTabs,
  parseTab,
  type DiscoverTab,
} from "~/components/discover/DiscoverTabs";
import { ProfileGrid } from "~/components/discover/ProfileGrid";
import { useOptimisticLikes } from "~/hooks/useOptimisticLikes";
import { useInfiniteScroll } from "~/hooks/useInfiniteScroll";
import { useDiscoverPages } from "~/hooks/useDiscoverPages";
import { loadCustomerDiscover } from "~/services/discover.server";
import { HeaderSearch } from "~/components/discover/HeaderSearch";
import type { DiscoverProfile } from "~/components/discover/ProfileCard";
import { calculateAgeFromDOB } from "~/utils";

const PER_PAGE = 40;

export async function loader({ request }: LoaderFunctionArgs) {
  const customerId = await requireVerifiedUserSession(request);
  const tab = parseTab(new URL(request.url).searchParams.get("tab"));

  const { prisma } = await import("~/services/database.server");
  const me = await prisma.customer.findUnique({
    where: { id: customerId },
    select: { latitude: true, longitude: true },
  });
  const hasLocation = !!(me?.latitude && me?.longitude);

  const { profiles, hasMore } = await loadCustomerDiscover(
    customerId,
    tab,
    1,
    hasLocation
  );

  return { profiles, hasMore, hasLocation };
}

export async function action({ request }: ActionFunctionArgs) {
  const customerId = await requireVerifiedUserSession(request);
  const formData = await request.formData();
  const modelId = String(formData.get("modelId") ?? "");
  const liked = formData.get("liked") === "true";

  if (!modelId) return { success: false };

  // `setCustomerLike` is idempotent — it sets the state rather than toggling,
  // so a double tap or a stale card can't invert the result. Un-liking only
  // removes the LIKE; it never records a PASS, which would hide the profile
  // from Discover entirely.
  const { setCustomerLike } = await import("~/services/interaction.server");
  const result = await setCustomerLike(customerId, modelId, liked);
  return { success: result.success, liked: result.liked, modelId };
}

export default function CustomerDiscover() {
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
    endpoint: "/customer/discover/load-more",
    tab,
  });
  const sentinelRef = useInfiniteScroll({
    enabled: hasMore && !loadingMore,
    onLoadMore: loadMore,
  });

  // Instant feedback on tap, held steady until the loader catches up.
  const optimistic = useOptimisticLikes(profiles, likeFetcher, "modelId");

  const emptyForTab: Record<DiscoverTab, string> = {
    all: t("discover.emptyTitle", { defaultValue: "Nobody here yet" }),
    forYou: t("discover.emptyTitle", { defaultValue: "Nobody here yet" }),
    likeMe: t("matches.noLikesYet", {
      defaultValue: "Nobody has liked you yet",
    }),
    iLike: t("matches.noFavouritesYet", {
      defaultValue: "You haven't liked anyone yet",
    }),
  };

  return (
    <div className="flex flex-col min-h-full bg-white">
      {/* Desktop puts the search field in the header itself, top-right.
          On mobile there is no room, so the icon next to the notification
          bell in the layout header opens it as a dropdown instead. */}
      <div className="flex items-start justify-between gap-4 px-4 pt-4 pb-2">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold" suppressHydrationWarning>
            {t("navigation.discover")}
          </h1>
          <p className="text-xs text-gray-500 truncate" suppressHydrationWarning>
            {t("discover.subtitle", { defaultValue: "Find people near you" })}
          </p>
        </div>
        <div className="hidden sm:block shrink-0">
          <HeaderSearch
            variant="input"
            searchAction="/customer/discover/find"
            hrefFor={(id) => `/customer/user-profile/${id}`}
          />
        </div>
      </div>

      <DiscoverTabs basePath="/customer" />

      {!hasLocation && (tab === "all" || tab === "forYou") && (
        <p className="px-4 py-2 text-xs text-amber-700 bg-amber-50 border-b border-amber-200">
          {t("discover.noLocation", {
            defaultValue:
              "Turn on location to sort people by how near they are.",
          })}
        </p>
      )}

      <ProfileGrid
        profiles={optimistic}
        hrefFor={(id) => `/customer/user-profile/${id}`}
        onToggleLike={(modelId, nextLiked) =>
          likeFetcher.submit(
            { modelId, liked: String(nextLiked) },
            { method: "post" }
          )
        }
        emptyTitle={emptyForTab[tab]}
        sentinelRef={sentinelRef}
        loadingMore={loadingMore}
        endReached={!hasMore}
      />
    </div>
  );
}
