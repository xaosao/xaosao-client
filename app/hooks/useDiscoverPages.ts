/**
 * Accumulates Discover pages as the user scrolls.
 *
 * The route loader supplies page 1; each subsequent page comes from a fetcher
 * hitting the load-more resource route. Two things this has to get right:
 *
 *  - **Reset on tab change.** Tabs are query-string navigations, so the
 *    component isn't remounted — without an explicit reset the new tab would
 *    render appended to the previous tab's rows.
 *  - **De-duplicate.** The underlying lists are re-queried per page and rows
 *    can shift between requests (someone's `lastMessage` or distance changes),
 *    so the same profile can legitimately arrive twice. Keying by id keeps the
 *    grid from rendering duplicates.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useFetcher } from "react-router";
import type { DiscoverProfile } from "~/components/discover/ProfileCard";

interface Options {
  firstPage: DiscoverProfile[];
  firstHasMore: boolean;
  /** Resource route returning `{ profiles, hasMore, page }`. */
  endpoint: string;
  /** Current tab — a change resets the accumulated pages. */
  tab: string;
}

interface Result {
  profiles: DiscoverProfile[];
  hasMore: boolean;
  loadingMore: boolean;
  loadMore: () => void;
}

export function useDiscoverPages({
  firstPage,
  firstHasMore,
  endpoint,
  tab,
}: Options): Result {
  const fetcher = useFetcher<{
    profiles: DiscoverProfile[];
    hasMore: boolean;
    page: number;
  }>();

  const [extraPages, setExtraPages] = useState<DiscoverProfile[]>([]);
  const [hasMore, setHasMore] = useState(firstHasMore);
  const pageRef = useRef(1);
  // Which page numbers we've already merged, so React 18's double-invoked
  // effects (or a repeated observer fire) can't append the same page twice.
  const mergedPages = useRef(new Set<number>());

  // Loader data replaced (tab switch, revalidation) — start over.
  useEffect(() => {
    setExtraPages([]);
    setHasMore(firstHasMore);
    pageRef.current = 1;
    mergedPages.current = new Set();
  }, [tab, firstPage, firstHasMore]);

  useEffect(() => {
    if (fetcher.state !== "idle" || !fetcher.data) return;
    const { profiles: incoming, hasMore: more, page } = fetcher.data;
    if (typeof page === "number") {
      if (mergedPages.current.has(page)) return;
      mergedPages.current.add(page);
    }
    if (incoming?.length) {
      setExtraPages((current) => [...current, ...incoming]);
    }
    setHasMore(!!more && (incoming?.length ?? 0) > 0);
  }, [fetcher.state, fetcher.data]);

  const loadMore = useCallback(() => {
    if (fetcher.state !== "idle" || !hasMore) return;
    const next = pageRef.current + 1;
    pageRef.current = next;
    fetcher.load(`${endpoint}?tab=${encodeURIComponent(tab)}&page=${next}`);
  }, [endpoint, tab, hasMore, fetcher]);

  // Merge, keeping first occurrence of each id.
  const seen = new Set<string>();
  const profiles: DiscoverProfile[] = [];
  for (const profile of [...firstPage, ...extraPages]) {
    if (seen.has(profile.id)) continue;
    seen.add(profile.id);
    profiles.push(profile);
  }

  return {
    profiles,
    hasMore,
    loadingMore: fetcher.state !== "idle",
    loadMore,
  };
}
