import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { X, Bell, BellOff, Check } from "lucide-react";
import { Button } from "~/components/ui/button";
import { usePushNotifications } from "~/hooks/usePushNotifications";

interface PushNotificationPromptProps {
  userType: "model" | "customer";
}

// Only remember dismissal for current session (until page refresh)
const sessionDismissed: Record<string, boolean> = {};

// Check if app is running as PWA
function isStandalone(): boolean {
  try {
    if (typeof window === "undefined") return false;
    return (
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as any).standalone === true
    );
  } catch {
    return false;
  }
}

// Check if device is iOS
function isIOS(): boolean {
  try {
    if (typeof window === "undefined") return false;
    return /iPad|iPhone|iPod/.test(navigator.userAgent);
  } catch {
    return false;
  }
}

// Check if iOS version supports Web Push (16.4+)
function isIOSVersionSupported(): boolean {
  try {
    if (!isIOS()) return true; // Non-iOS devices don't need this check

    const match = navigator.userAgent.match(/OS (\d+)_(\d+)/);
    if (!match) return false;

    const major = parseInt(match[1], 10);
    const minor = parseInt(match[2], 10);

    // iOS 16.4+ supports Web Push
    return major > 16 || (major === 16 && minor >= 4);
  } catch {
    return false;
  }
}

export function PushNotificationPrompt({ userType }: PushNotificationPromptProps) {
  const { t } = useTranslation();
  const [showPrompt, setShowPrompt] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [isIOSSafari, setIsIOSSafari] = useState(false);
  const [isIOSPWA, setIsIOSPWA] = useState(false);

  const {
    isSupported,
    permission,
    isSubscribed,
    isLoading,
    isInitializing,
    error,
    subscribe,
  } = usePushNotifications({ userType });

  useEffect(() => {
    // Only run on client
    if (typeof window === "undefined") return;

    let timer: ReturnType<typeof setTimeout> | null = null;

    try {
      const iosDevice = isIOS();
      const standalonePWA = isStandalone();
      const iosVersionOK = isIOSVersionSupported();

      console.log("[PushPrompt] Device detection:", {
        isIOS: iosDevice,
        isStandalone: standalonePWA,
        isIOSVersionSupported: iosVersionOK,
        userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "N/A",
      });

      // Check if we're on iOS Safari (not PWA)
      const iosInSafari = iosDevice && !standalonePWA;
      setIsIOSSafari(iosInSafari);

      // Check if we're on iOS PWA (standalone mode)
      const iosInPWA = iosDevice && standalonePWA && iosVersionOK;
      setIsIOSPWA(iosInPWA);

      // For iOS Safari, show instructions to add to home screen
      if (iosInSafari && iosVersionOK) {
        console.log("[PushPrompt] iOS Safari detected");

        if (sessionDismissed[userType]) {
          console.log("[PushPrompt] Not showing: Dismissed in current session");
          return;
        }

        console.log("[PushPrompt] Will show iOS instructions in 3 seconds...");
        timer = setTimeout(() => {
          console.log("[PushPrompt] Showing iOS instructions now!");
          setShowPrompt(true);
        }, 3000);
        return;
      }

      // For iOS PWA or other devices, use the standard flow
      // Wait for hook to finish initializing
      if (isInitializing) {
        console.log("[PushPrompt] Still initializing, waiting...");
        return;
      }

      console.log("[PushPrompt] Checking conditions:", {
        isSupported,
        isSubscribed,
        permission,
        userType,
        iosInPWA,
      });

      // For iOS PWA, show prompt if not subscribed (even if isSupported is false)
      const shouldShowForIOSPWA = iosInPWA && !isSubscribed && permission !== "denied";

      // For other devices, check isSupported
      const shouldShowForOther = !iosDevice && isSupported && !isSubscribed && permission !== "denied";

      if (!shouldShowForIOSPWA && !shouldShowForOther) {
        console.log("[PushPrompt] Not showing prompt");
        return;
      }

      if (sessionDismissed[userType]) {
        console.log("[PushPrompt] Not showing: Dismissed in current session");
        return;
      }

      console.log("[PushPrompt] Will show prompt in 3 seconds...");
      timer = setTimeout(() => {
        console.log("[PushPrompt] Showing prompt now!");
        setShowPrompt(true);
      }, 3000);

    } catch (err) {
      console.error("[PushPrompt] Error in useEffect:", err);
    }

    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [isSupported, isSubscribed, permission, userType, isInitializing]);

  const handleEnable = async () => {
    const success = await subscribe();
    if (success) {
      setShowSuccess(true);
      // Auto close modal after showing success message
      setTimeout(() => {
        setShowPrompt(false);
      }, 2000);
    }
  };

  const handleDismiss = () => {
    // Only dismiss for current session - will show again on page refresh
    sessionDismissed[userType] = true;
    setShowPrompt(false);
  };

  // For iOS Safari, we show even when isSupported is false (to show instructions)
  // For iOS PWA, we show the enable button (bypass isSupported check)
  // For other platforms, we need isSupported to be true
  if (!showPrompt) {
    return null;
  }

  // On non-iOS platforms, still check isSupported
  // But skip this check for iOS PWA (we handle it separately)
  if (!isIOSSafari && !isIOSPWA && !isSupported) {
    return null;
  }

  // Show iOS-specific instructions if in Safari (not PWA)
  // iOS PWA should show the enable button, not instructions
  const showIOSInstructions = isIOSSafari && !isIOSPWA;

  return (
    <div className="fixed inset-0 z-[10000] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="w-full max-w-md bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl animate-in slide-in-from-bottom duration-300">
        <div className="relative p-4 border-b">
          <button
            onClick={handleDismiss}
            className="absolute right-4 top-4 p-1 rounded-full hover:bg-gray-100"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-sm shadow-md bg-rose-500 flex items-center justify-center">
              {showSuccess ? (
                <Check className="w-5 h-5 text-white" />
              ) : (
                <Bell className="w-5 h-5 text-white" />
              )}
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                {showSuccess
                  ? t("push.enabled", { defaultValue: "Notifications Enabled!" })
                  : t("push.title", { defaultValue: "Stay Updated" })}
              </h2>
              <p className="text-sm text-gray-500">
                {showSuccess
                  ? t("push.enabledDesc", { defaultValue: "You'll receive important updates" })
                  : t("push.subtitle", { defaultValue: "Enable push notifications" })}
              </p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {showSuccess ? (
            <p className="text-sm text-gray-600 text-center">
              {t("push.successMessage", {
                defaultValue: "You'll now receive notifications for bookings, messages, and updates.",
              })}
            </p>
          ) : showIOSInstructions ? (
            <>
              <p className="text-sm text-gray-600">
                {t("push.iosInstruction", {
                  defaultValue:
                    "To receive notifications on iOS, please add this app to your home screen first.",
                })}
              </p>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 space-y-2">
                <p className="text-sm font-medium text-blue-800">
                  {t("push.iosStepsTitle", { defaultValue: "How to add:" })}
                </p>
                <ol className="text-sm text-blue-700 space-y-1 list-decimal list-inside">
                  <li>{t("push.iosStep1", { defaultValue: "Tap the Share button (square with arrow)" })}</li>
                  <li>{t("push.iosStep2", { defaultValue: "Scroll down and tap \"Add to Home Screen\"" })}</li>
                  <li>{t("push.iosStep3", { defaultValue: "Tap \"Add\" to confirm" })}</li>
                  <li>{t("push.iosStep4", { defaultValue: "Open the app from your home screen" })}</li>
                </ol>
              </div>
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                <p className="text-sm text-amber-800">
                  {t("push.iosNote", {
                    defaultValue:
                      "Push notifications on iOS only work when the app is added to home screen.",
                  })}
                </p>
              </div>
            </>
          ) : (
            <>
              <p className="text-sm text-gray-600">
                {t("push.description", {
                  defaultValue:
                    "Get notified about new bookings, messages, and important updates even when you're not using the app.",
                })}
              </p>

              <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                <div className="flex items-center gap-3 text-sm text-gray-600">
                  <div className="w-8 h-8 bg-rose-100 rounded-full flex items-center justify-center shrink-0">
                    <Bell className="w-4 h-4 text-rose-500" />
                  </div>
                  <span>
                    {userType === "model"
                      ? t("push.benefitModel1", { defaultValue: "New booking requests" })
                      : t("push.benefitCustomer1", { defaultValue: "Booking confirmations" })}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-sm text-gray-600">
                  <div className="w-8 h-8 bg-rose-100 rounded-full flex items-center justify-center shrink-0">
                    <Bell className="w-4 h-4 text-rose-500" />
                  </div>
                  <span>
                    {t("push.benefitMessages", { defaultValue: "New messages" })}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-sm text-gray-600">
                  <div className="w-8 h-8 bg-rose-100 rounded-full flex items-center justify-center shrink-0">
                    <Bell className="w-4 h-4 text-rose-500" />
                  </div>
                  <span>
                    {userType === "model"
                      ? t("push.benefitModel3", { defaultValue: "Payment notifications" })
                      : t("push.benefitCustomer3", { defaultValue: "Service updates" })}
                  </span>
                </div>
              </div>
            </>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          {permission === "denied" && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
              <p className="text-sm text-amber-800">
                {t("push.permissionDenied", {
                  defaultValue:
                    "Notifications are blocked. Please enable them in your browser settings.",
                })}
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t flex gap-3">
          {!showSuccess && (
            <>
              <Button
                variant="outline"
                className="flex-1"
                onClick={handleDismiss}
                disabled={isLoading}
              >
                {t("push.notNow", { defaultValue: "Not Now" })}
              </Button>
              {!showIOSInstructions && (
                <Button
                  className="flex-1 bg-rose-500 hover:bg-rose-600 text-white"
                  onClick={handleEnable}
                  disabled={isLoading || permission === "denied"}
                >
                  {isLoading ? (
                    <span className="flex items-center gap-2">
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      {t("push.enabling", { defaultValue: "Enabling..." })}
                    </span>
                  ) : (
                    <>
                      <Bell className="w-4 h-4" />
                      {t("push.enable", { defaultValue: "Enable Notifications" })}
                    </>
                  )}
                </Button>
              )}
              {showIOSInstructions && (
                <Button
                  className="flex-1 bg-rose-500 hover:bg-rose-600 text-white"
                  onClick={handleDismiss}
                >
                  {t("push.gotIt", { defaultValue: "Got it" })}
                </Button>
              )}
            </>
          )}
        </div>

        <div className="h-safe-area-inset-bottom" />
      </div>
    </div>
  );
}

/**
 * Small inline banner for notification settings
 */
export function PushNotificationBanner({ userType }: PushNotificationPromptProps) {
  const { t } = useTranslation();
  const {
    isSupported,
    permission,
    isSubscribed,
    isLoading,
    subscribe,
    unsubscribe,
  } = usePushNotifications({ userType });

  if (!isSupported) return null;

  // Don't show if permission denied (user needs to fix in browser settings)
  if (permission === "denied") {
    return (
      <div className="flex items-center justify-between p-3 bg-amber-50 border border-amber-200 rounded-lg">
        <div className="flex items-center gap-3">
          <BellOff className="w-5 h-5 text-amber-600" />
          <div>
            <p className="text-sm font-medium text-amber-800">
              {t("push.blockedTitle", { defaultValue: "Notifications Blocked" })}
            </p>
            <p className="text-xs text-amber-600">
              {t("push.blockedDesc", {
                defaultValue: "Enable in browser settings",
              })}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between p-3 bg-gray-50 border border-gray-200 rounded-lg">
      <div className="flex items-center gap-3">
        <Bell className={`w-5 h-5 ${isSubscribed ? "text-rose-500" : "text-gray-400"}`} />
        <div>
          <p className="text-sm font-medium text-gray-800">
            {t("push.settingTitle", { defaultValue: "Push Notifications" })}
          </p>
          <p className="text-xs text-gray-500">
            {isSubscribed
              ? t("push.settingEnabled", { defaultValue: "Enabled on this device" })
              : t("push.settingDisabled", { defaultValue: "Receive updates anywhere" })}
          </p>
        </div>
      </div>
      <Button
        size="sm"
        variant={isSubscribed ? "outline" : "default"}
        className={!isSubscribed ? "bg-rose-500 hover:bg-rose-600" : ""}
        onClick={() => (isSubscribed ? unsubscribe() : subscribe())}
        disabled={isLoading}
      >
        {isLoading ? (
          <span className="w-4 h-4 border-2 border-current/30 border-t-current rounded-full animate-spin" />
        ) : isSubscribed ? (
          t("push.disable", { defaultValue: "Disable" })
        ) : (
          t("push.enable", { defaultValue: "Enable" })
        )}
      </Button>
    </div>
  );
}
