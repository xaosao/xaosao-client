import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { X, Bell, BellOff, Check } from "lucide-react";
import { Button } from "~/components/ui/button";
import { usePushNotifications } from "~/hooks/usePushNotifications";

interface PushNotificationPromptProps {
  userType: "model" | "customer";
}

const STORAGE_KEY = "push-notification-prompt-dismissed";
const DISMISS_DURATION = 7 * 24 * 60 * 60 * 1000; // 7 days

// Check if app is running as PWA
function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as any).standalone === true
  );
}

// Check if device is iOS
function isIOS(): boolean {
  if (typeof window === "undefined") return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent);
}

export function PushNotificationPrompt({ userType }: PushNotificationPromptProps) {
  const { t } = useTranslation();
  const [showPrompt, setShowPrompt] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

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
      isInitializing,
    });

    // Don't show if not supported
    if (!isSupported) {
      console.log("[PushPrompt] Not showing: Push not supported");
      return;
    }

    // Don't show if already subscribed
    if (isSubscribed) {
      console.log("[PushPrompt] Not showing: Already subscribed");
      return;
    }

    // Don't show if permission denied
    if (permission === "denied") {
      console.log("[PushPrompt] Not showing: Permission denied");
      return;
    }

    // Check if user dismissed recently
    const dismissedAt = localStorage.getItem(STORAGE_KEY);
    if (dismissedAt) {
      const dismissedTime = parseInt(dismissedAt, 10);
      if (Date.now() - dismissedTime < DISMISS_DURATION) {
        console.log("[PushPrompt] Not showing: Dismissed recently");
        return;
      }
    }

    console.log("[PushPrompt] Will show prompt in 3 seconds...");

    // Show prompt after a short delay
    const timer = setTimeout(() => {
      console.log("[PushPrompt] Showing prompt now!");
      setShowPrompt(true);
    }, 3000);

    return () => clearTimeout(timer);
  }, [isSupported, isSubscribed, permission, userType, isInitializing]);

  const handleEnable = async () => {
    const success = await subscribe();
    if (success) {
      setShowSuccess(true);
      setTimeout(() => {
        setShowPrompt(false);
      }, 2000);
    }
  };

  const handleDismiss = () => {
    localStorage.setItem(STORAGE_KEY, Date.now().toString());
    setShowPrompt(false);
  };

  if (!showPrompt || !isSupported) {
    return null;
  }

  // Show iOS-specific instructions if needed
  const showIOSInstructions = isIOS() && !isStandalone();

  return (
    <div className="fixed inset-0 z-[10000] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="w-full max-w-md bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl animate-in slide-in-from-bottom duration-300">
        {/* Header */}
        <div className="relative p-4 border-b">
          <button
            onClick={handleDismiss}
            className="absolute right-4 top-4 p-1 rounded-full hover:bg-gray-100"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
          <div className="flex items-center gap-3">
            <div className="w-14 h-14 rounded-xl shadow-md bg-rose-500 flex items-center justify-center">
              {showSuccess ? (
                <Check className="w-8 h-8 text-white" />
              ) : (
                <Bell className="w-8 h-8 text-white" />
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
                      <Bell className="w-4 h-4 mr-2" />
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

        {/* Safe area padding for iOS */}
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
