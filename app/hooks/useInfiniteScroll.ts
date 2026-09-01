/**
 * Fires `onLoadMore` when a sentinel element scrolls into view.
 *
 * `rootMargin` starts the fetch before the sentinel is actually visible, so
 * the next rows are usually in place by the time the user reaches the bottom.
 *
 * The guard matters: IntersectionObserver fires repeatedly while the sentinel
 * stays in view, and an empty final page keeps it on screen — without
 * `enabled` being flipped off by the caller (and the in-flight check here),
 * that becomes a request loop.
 */

import { useEffect, useRef } from "react";

interface Options {
  /** False when there is nothing more to load or a request is in flight. */
  enabled: boolean;
  onLoadMore: () => void;
  /** How early to trigger, in px. */
  rootMargin?: string;
}

export function useInfiniteScroll({
  enabled,
  onLoadMore,
  rootMargin = "400px",
}: Options) {
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const onLoadMoreRef = useRef(onLoadMore);
  onLoadMoreRef.current = onLoadMore;

  useEffect(() => {
    const node = sentinelRef.current;
    if (!node || !enabled || typeof IntersectionObserver === "undefined") return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          onLoadMoreRef.current();
        }
      },
      { rootMargin }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [enabled, rootMargin]);

  return sentinelRef;
}
