/**
 * Keeps a full-screen chat view pinned to the *visible* part of the screen
 * while the iOS keyboard is open.
 *
 * The problem this solves:
 *
 * On iOS the software keyboard does not shrink the layout viewport — `100dvh`
 * still reports the full screen height. To reveal a focused input, Safari
 * instead scrolls the whole DOCUMENT up, and it does **not** restore that
 * scroll when the keyboard closes. Dismissing via "Done" or tapping away
 * therefore leaves the page permanently offset: the header disappears under
 * the status bar and the composer sits in the wrong place.
 *
 * `window.visualViewport` reports the region actually visible above the
 * keyboard. Sizing the container to that height means the composer is never
 * covered, so Safari has no reason to scroll the document at all — and we
 * force `scrollY` back to 0 on every keyboard transition to undo any scroll
 * it performed before we resized.
 *
 * Returns the visible height in px, or `null` before measurement / on
 * browsers without the API (callers fall back to their CSS height).
 */

import { useEffect, useState } from "react";

export function useVisualViewportHeight(enabled = true): number | null {
  const [height, setHeight] = useState<number | null>(null);

  useEffect(() => {
    if (!enabled || typeof window === "undefined") return;

    const viewport = window.visualViewport;
    if (!viewport) return;

    const timers: ReturnType<typeof setTimeout>[] = [];

    const resetScroll = () => {
      // iOS scrolls the document DURING the keyboard animation, so a single
      // immediate reset loses the race. Re-assert across the animation window
      // (~350ms) so the last word is ours. `useBodyScrollLock` should make
      // this unnecessary; it stays as defence for browsers where the lock is
      // not in effect.
      for (const delay of [0, 60, 150, 300, 450]) {
        timers.push(
          setTimeout(() => {
            if (window.scrollY !== 0) window.scrollTo(0, 0);
          }, delay)
        );
      }
    };

    const apply = () => {
      setHeight(viewport.height);
      resetScroll();
    };

    setHeight(viewport.height);
    viewport.addEventListener("resize", apply);

    // Some iOS versions fire only `scroll` when the accessory bar toggles.
    viewport.addEventListener("scroll", apply);

    return () => {
      timers.forEach(clearTimeout);
      viewport.removeEventListener("resize", apply);
      viewport.removeEventListener("scroll", apply);
    };
  }, [enabled]);

  return height;
}
