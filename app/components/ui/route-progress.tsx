/**
 * Global navigation feedback.
 *
 * React Router loads the next route's data BEFORE swapping the view, so
 * without any indicator a click on a slow page (discover, matches, chat)
 * looks like nothing happened. This renders:
 *
 *   - a thin progress bar across the top during any navigation or submission
 *   - a subtle page-level dim once a navigation runs long, so the user knows
 *     the click registered and the app isn't frozen
 *
 * The bar eases toward 90% while loading and snaps to 100% on completion —
 * real progress isn't knowable, but motion communicates "working".
 */

import { useEffect, useRef, useState } from "react";
import { useNavigation } from "react-router";

/** Don't flash the bar for instant transitions. */
const SHOW_AFTER_MS = 120;
/** Only dim the page once it's slow enough to feel stuck. */
const DIM_AFTER_MS = 600;

export function RouteProgress() {
  const navigation = useNavigation();
  const isBusy = navigation.state !== "idle";

  const [visible, setVisible] = useState(false);
  const [dimmed, setDimmed] = useState(false);
  const [progress, setProgress] = useState(0);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const ticker = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const clearAll = () => {
      timers.current.forEach(clearTimeout);
      timers.current = [];
      if (ticker.current) {
        clearInterval(ticker.current);
        ticker.current = null;
      }
    };

    if (isBusy) {
      clearAll();
      timers.current.push(
        setTimeout(() => {
          setVisible(true);
          setProgress(15);
          // Ease toward 90% — decelerating so it never appears to stall.
          ticker.current = setInterval(() => {
            setProgress((p) => (p >= 90 ? 90 : p + Math.max(1, (90 - p) / 8)));
          }, 180);
        }, SHOW_AFTER_MS)
      );
      timers.current.push(setTimeout(() => setDimmed(true), DIM_AFTER_MS));
    } else {
      clearAll();
      setDimmed(false);
      setProgress((p) => (p > 0 ? 100 : 0));
      // Let the 100% state paint before hiding.
      timers.current.push(
        setTimeout(() => {
          setVisible(false);
          setProgress(0);
        }, 220)
      );
    }

    return clearAll;
  }, [isBusy]);

  if (!visible && !dimmed) return null;

  return (
    <>
      {visible && (
        <div
          className="fixed top-0 left-0 right-0 z-[100] h-[3px] bg-rose-100/40 pointer-events-none"
          role="progressbar"
          aria-label="Loading"
          aria-busy={isBusy}
        >
          <div
            className="h-full bg-gradient-to-r from-rose-400 to-rose-600 shadow-[0_0_8px_rgba(244,63,94,0.6)] transition-[width] duration-200 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}
      {dimmed && (
        // pointer-events-none: this is feedback, never an input blocker.
        <div className="fixed inset-0 z-[99] bg-white/25 backdrop-blur-[1px] pointer-events-none transition-opacity duration-200" />
      )}
    </>
  );
}
