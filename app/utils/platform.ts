/**
 * Platform detection + CTA routing helpers.
 *
 * We ship an Android app on Play Store — every landing-page CTA should
 * push Android users to install it instead of using the mobile web.
 * iOS and desktop users keep the existing web flow until the iOS app
 * ships.
 */

export const PLAY_STORE_URL =
  "https://play.google.com/store/apps/details?id=com.xaosao.mobile";

/** True when the current user agent is Android. Client-only — returns false during SSR. */
export function isAndroid(): boolean {
  if (typeof navigator === "undefined") return false;
  return /Android/i.test(navigator.userAgent);
}

/** True when the current user agent is iOS (iPhone/iPad/iPod). */
export function isIOS(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iPhone|iPad|iPod/i.test(navigator.userAgent);
}

/**
 * Where a landing-page "Get started" CTA should send the user.
 *   - Android → Play Store install page (force app install)
 *   - Everyone else → the provided web fallback (login / register / etc.)
 */
export function ctaTarget(webFallback: string): string {
  return isAndroid() ? PLAY_STORE_URL : webFallback;
}

/**
 * Navigate to the correct CTA target. On Android this leaves the site
 * (window.location) — that's intentional; the user should end up on the
 * Play Store, not deep in the SPA.
 *
 * @param webFallback the URL non-Android users should reach.
 */
export function goToCta(webFallback: string): void {
  if (typeof window === "undefined") return;
  window.location.href = ctaTarget(webFallback);
}
