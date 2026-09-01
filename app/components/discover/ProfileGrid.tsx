/**
 * The 2-column card grid plus its empty state. Shared by both Discover sides.
 */

import { Compass, Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { ProfileCard, type DiscoverProfile } from "./ProfileCard";

interface ProfileGridProps {
  profiles: DiscoverProfile[];
  /** Builds the destination for a card, e.g. id => `/customer/user-profile/${id}`. */
  hrefFor: (id: string) => string;
  onToggleLike?: (id: string, nextLiked: boolean) => void;
  pendingLikeIds?: Set<string>;
  emptyTitle?: string;
  emptySubtitle?: string;
  /** Infinite scroll: attach to the sentinel rendered after the grid. */
  sentinelRef?: React.Ref<HTMLDivElement>;
  loadingMore?: boolean;
  /** Shown once the user has reached the end of the list. */
  endReached?: boolean;
}

export function ProfileGrid({
  profiles,
  hrefFor,
  onToggleLike,
  pendingLikeIds,
  emptyTitle,
  emptySubtitle,
  sentinelRef,
  loadingMore = false,
  endReached = false,
}: ProfileGridProps) {
  const { t } = useTranslation();

  if (profiles.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 px-8 text-center">
        <Compass className="w-12 h-12 text-gray-300 mb-3" />
        <p className="text-sm font-medium text-gray-600" suppressHydrationWarning>
          {emptyTitle ??
            t("discover.emptyTitle", { defaultValue: "Nobody here yet" })}
        </p>
        {emptySubtitle && (
          <p className="text-xs text-gray-400 mt-1">{emptySubtitle}</p>
        )}
      </div>
    );
  }

  return (
    <>
      {/* 2 up on phones, widening to 5 per row on a desktop screen. */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 p-3">
        {profiles.map((profile) => (
          <ProfileCard
            key={profile.id}
            profile={profile}
            href={hrefFor(profile.id)}
            onToggleLike={onToggleLike}
            likePending={pendingLikeIds?.has(profile.id)}
          />
        ))}
      </div>

      {/* Sentinel — the observer watches this, so it must sit AFTER the grid
          and stay in the tree even while a page is loading. */}
      <div ref={sentinelRef} className="h-px" aria-hidden />

      {loadingMore && (
        <div className="flex items-center justify-center py-6 text-gray-400">
          <Loader2 className="w-5 h-5 animate-spin" />
        </div>
      )}

      {endReached && !loadingMore && profiles.length > 0 && (
        <p className="text-center text-xs text-gray-400 py-6">
          {t("discover.endOfList", { defaultValue: "That's everyone" })}
        </p>
      )}
    </>
  );
}
