import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { X, Bell, BellOff, Check } from "lucide-react";
import { Button } from "~/components/ui/button";
import { usePushNotifications } from "~/hooks/usePushNotifications";

interface PushNotificationPromptProps {
  userType: "model" | "customer";
  hasEnabledNotifications?: boolean;
  enabled?: boolean;
  onDismiss?: () => void;
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

// Check if device is Android
function isAndroid(): boolean {
  try {
    if (typeof window === "undefined") return false;
    return /Android/.test(navigator.userAgent);
  } catch {
    return false;
  }
}

export function PushNotificationPrompt({ userType, hasEnabledNotifications, enabled = true, onDismiss }: PushNotificationPromptProps) {
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
    if (typeof window === "undefined") return;
    if (!enabled) return;

    let timer: ReturnType<typeof setTimeout> | null = null;

    try {
      // Android only - skip iOS devices entirely
      if (!isAndroid()) {
        console.log("[PushPrompt] Not Android, skipping");
        onDismiss?.();
        return;
      }

      // Wait for hook to finish initializing
      if (isInitializing) {
        console.log("[PushPrompt] Still initializing, waiting...");
        return;
      }

      // Don't show if notifications are already enabled
      if (hasEnabledNotifications) {
        console.log("[PushPrompt] Not showing: Notifications already enabled");
        onDismiss?.();
        return;
      }

      // Check if push is supported and not already subscribed
      if (!isSupported || isSubscribed || permission === "denied") {
        console.log("[PushPrompt] Not showing: conditions not met", { isSupported, isSubscribed, permission });
        onDismiss?.();
        return;
      }

      if (sessionDismissed[userType]) {
        console.log("[PushPrompt] Not showing: Dismissed in current session");
        onDismiss?.();
        return;
      }

      console.log("[PushPrompt] Will show prompt in 1 second...");
      timer = setTimeout(() => {
        setShowPrompt(true);
      }, 1000);

    } catch (err) {
      console.error("[PushPrompt] Error in useEffect:", err);
      onDismiss?.();
    }

    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [enabled, isSupported, isSubscribed, permission, userType, isInitializing, hasEnabledNotifications, onDismiss]);

  const handleEnable = async () => {
    const success = await subscribe();
    if (success) {
      try {
        await fetch("/api/notifications/update-settings", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userType, sendPushNoti: true, sendSMSNoti: true }),
        });
      } catch (error) {
        console.error("[PushPrompt] Failed to update notification settings:", error);
      }

      setShowSuccess(true);
      setTimeout(() => {
        setShowPrompt(false);
        onDismiss?.();
      }, 2000);
    }
  };

  const handleDismiss = () => {
    sessionDismissed[userType] = true;
    setShowPrompt(false);
    onDismiss?.();
  };

  if (!showPrompt) return null;
  if (!isSupported) return null;

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
