/**
 * Locks the document while a full-screen view (the chat thread) is mounted.
 *
 * Why this is needed rather than just resetting `scrollY`:
 *
 * iOS scrolls the DOCUMENT to reveal a focused input, and it performs that
 * scroll asynchronously, during the ~250-350ms keyboard animation. Any reset
 * fired on `blur` or on the `visualViewport` resize therefore runs BEFORE
 * iOS's own adjustment and gets overwritten — which is why tapping the
 * scroll-to-top button (a late, user-timed reset) appeared to work while an
 * automatic one didn't.
 *
 * `position: fixed` on <body> removes the scroll container entirely, so there
 * is nothing for iOS to strand. The previous scroll offset is captured on
 * mount and restored on unmount, so returning to the page you came from lands
 * exactly where you left it.
 */

import { useEffect } from "react";

export function useBodyScrollLock(enabled = true) {
  useEffect(() => {
    if (!enabled || typeof document === "undefined") return;

    const html = document.documentElement;
    const body = document.body;

    // Where the user was before entering — restored on the way out.
    const scrollY = window.scrollY;

    const previous = {
      htmlOverflow: html.style.overflow,
      bodyOverflow: body.style.overflow,
      bodyPosition: body.style.position,
      bodyTop: body.style.top,
      bodyLeft: body.style.left,
      bodyRight: body.style.right,
      bodyWidth: body.style.width,
    };

    html.style.overflow = "hidden";
    body.style.overflow = "hidden";
    body.style.position = "fixed";
    body.style.top = "0px";
    body.style.left = "0";
    body.style.right = "0";
    body.style.width = "100%";

    return () => {
      // Restore exactly what was there before — writing "" instead would
      // clobber any styling the app itself had set, which is how a screen
      // like this ends up "not going back to normal".
      html.style.overflow = previous.htmlOverflow;
      body.style.overflow = previous.bodyOverflow;
      body.style.position = previous.bodyPosition;
      body.style.top = previous.bodyTop;
      body.style.left = previous.bodyLeft;
      body.style.right = previous.bodyRight;
      body.style.width = previous.bodyWidth;

      window.scrollTo(0, scrollY);
    };
  }, [enabled]);
}
