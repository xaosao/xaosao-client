/**
 * The four Discover tabs, shared by the customer and model sides.
 *
 * Tab state lives in the URL (`?tab=`) rather than component state, so the
 * back button, refresh and prefetching all behave — and so the loader can pick
 * the right query server-side instead of over-fetching all four lists.
 */

import { Link, useSearchParams } from "react-router";
import { useTranslation } from "react-i18next";

export const DISCOVER_TABS = ["all", "forYou", "likeMe", "iLike"] as const;
export type DiscoverTab = (typeof DISCOVER_TABS)[number];

export function parseTab(value: string | null): DiscoverTab {
  return (DISCOVER_TABS as readonly string[]).includes(value ?? "")
    ? (value as DiscoverTab)
    : "all";
}

const LABEL_KEYS: Record<DiscoverTab, { key: string; fallback: string }> = {
  all: { key: "discoverTabs.all", fallback: "All" },
  forYou: { key: "matches.forYou", fallback: "For you" },
  likeMe: { key: "matches.likeMe", fallback: "Likes me" },
  iLike: { key: "matches.favourite", fallback: "I like" },
};

export function DiscoverTabs({ basePath }: { basePath: string }) {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const active = parseTab(searchParams.get("tab"));

  return (
    <div className="flex border-b bg-white overflow-x-auto no-scrollbar">
      {DISCOVER_TABS.map((tab) => {
        const isActive = tab === active;
        const { key, fallback } = LABEL_KEYS[tab];
        return (
          <Link
            key={tab}
            to={tab === "all" ? basePath : `${basePath}?tab=${tab}`}
            prefetch="intent"
            replace
            className={`flex-1 min-w-max px-4 py-3 text-sm text-center whitespace-nowrap transition-colors border-b-2 -mb-px active:scale-[0.97] ${
              isActive
                ? "border-rose-500 text-rose-500 font-bold"
                : "border-transparent text-gray-500 hover:text-rose-400"
            }`}
            suppressHydrationWarning
          >
            {t(key, { defaultValue: fallback })}
          </Link>
        );
      })}
    </div>
  );
}
