import { useEffect, useRef } from "react";
import { usePushNotifications } from "~/hooks/usePushNotifications";

/**
 * Subscribe this browser to push with no custom UI of its own.
 *
 * Ported from the pupatao project, where web push works today. The
 * difference there is not the sending code — that is the same VAPID Web
 * Push both projects use — it is that the subscribe call is actually
 * reachable. xaosao's only routes to it sat behind a custom modal that was
 * Android-only, waited on the location permission step, ran on one route,
 * and was suppressed by a stored preference that defaults to true. None of
 * those conditions were ever all true at once, so no browser ever
 * subscribed and the table stayed empty.
 *
 * The rules here:
 *   - permission already granted → subscribe silently on mount
 *   - not decided yet            → subscribe on the user's FIRST tap or
 *                                  keypress, because browsers only allow
 *                                  a permission request from a gesture
 *   - denied, unsupported, or an iPhone that hasn't installed the app to
 *     the home screen → do nothing
 *
 * The browser's own "Allow notifications?" dialog is the interface. There
 * is no way to skip it and no reason to wrap it in one of our own.
 *
 * Renders nothing. Mount once per authenticated layout.
 */
export function PushAutoEnable({
  userType,
}: {
  userType: "customer" | "model";
}) {
  const { isSupported, permission, isSubscribed, isInitializing, subscribe } =
    usePushNotifications({ userType });

  // Guards against a second attempt within the same page load: React may
  // re-run the effect as state settles, and a repeat subscribe would be a
  // wasted round-trip.
  const attempted = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    // Wait for the hook to finish reading the real PushManager state —
    // before that, `isSubscribed` is only the optimistic localStorage value.
    if (isInitializing) return;
    if (attempted.current) return;
    if (!isSupported || isSubscribed || permission === "denied") return;

    // iOS exposes the push APIs only to an app opened from the home screen.
    // In plain Safari, asking would fail, so stay quiet and let the settings
    // page explain how to install.
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const isStandalone =
      window.matchMedia?.("(display-mode: standalone)").matches ||
      (window.navigator as { standalone?: boolean }).standalone === true;
    if (isIOS && !isStandalone) return;

    if (permission === "granted") {
      attempted.current = true;
      void subscribe();
      return;
    }

    // Permission not decided yet. Hook the first interaction.
    const onGesture = () => {
      window.removeEventListener("pointerdown", onGesture);
      window.removeEventListener("keydown", onGesture);
      attempted.current = true;
      void subscribe();
    };
    window.addEventListener("pointerdown", onGesture, { once: true });
    window.addEventListener("keydown", onGesture, { once: true });

    return () => {
      window.removeEventListener("pointerdown", onGesture);
      window.removeEventListener("keydown", onGesture);
    };
  }, [isSupported, isSubscribed, permission, isInitializing, subscribe]);

  return null;
}
