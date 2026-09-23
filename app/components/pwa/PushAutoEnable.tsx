import { useEffect, useRef } from "react";
import { usePushNotifications } from "~/hooks/usePushNotifications";
import { isPushPromptDismissed } from "~/components/pwa/PushNotificationPrompt";

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

    // "Not Now" on the prompt means not now. Without this the native
    // permission dialog would appear on the user's very next tap, which is
    // a worse version of the thing they just declined. Settings still has
    // an always-available toggle, and the choice lasts one session.
    if (isPushPromptDismissed(userType)) return;

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
    //
    // Taps that land inside the push prompt are ignored and the listener
    // stays armed: that dialog has its own Enable and Not Now buttons, and
    // hijacking the tap here opened the native permission dialog before the
    // button's click could fire, which made the prompt impossible to close.
    const onGesture = (event: Event) => {
      const target = event.target as Element | null;
      if (target?.closest?.("[data-push-prompt]")) return;

      window.removeEventListener("pointerdown", onGesture);
      window.removeEventListener("keydown", onGesture);
      attempted.current = true;
      void subscribe();
    };
    window.addEventListener("pointerdown", onGesture);
    window.addEventListener("keydown", onGesture);

    return () => {
      window.removeEventListener("pointerdown", onGesture);
      window.removeEventListener("keydown", onGesture);
    };
  }, [isSupported, isSubscribed, permission, isInitializing, subscribe, userType]);

  return null;
}
