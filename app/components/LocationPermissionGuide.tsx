import { Settings, Smartphone, Monitor, RefreshCw, MapPin, Loader, ExternalLink } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

type DeviceType = "ios" | "android" | "desktop";
type BrowserType = "chrome" | "firefox" | "safari" | "edge" | "other";

function detectDevice(): DeviceType {
  if (typeof navigator === "undefined") return "desktop";

  const ua = navigator.userAgent.toLowerCase();

  // iOS detection
  if (/iphone|ipad|ipod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)) {
    return "ios";
  }

  // Android detection
  if (/android/.test(ua)) {
    return "android";
  }

  return "desktop";
}

function detectBrowser(): BrowserType {
  if (typeof navigator === "undefined") return "other";

  const ua = navigator.userAgent.toLowerCase();

  if (ua.includes("edg/")) return "edge";
  if (ua.includes("chrome") && !ua.includes("edg/")) return "chrome";
  if (ua.includes("firefox")) return "firefox";
  if (ua.includes("safari") && !ua.includes("chrome")) return "safari";

  return "other";
}

// Try to open device/browser settings
function openSettings(device: DeviceType, browser: BrowserType): boolean {
  try {
    if (device === "ios") {
      // iOS: Try to open app settings (works on some iOS versions)
      window.location.href = "app-settings:";
      return true;
    }

    if (device === "android") {
      // Android: Try to open location settings via intent
      // This works in Chrome and some other browsers
      window.location.href = "intent://settings/location_source#Intent;scheme=android-app;end";
      return true;
    }

    // Desktop: Can't directly open browser settings, return false
    return false;
  } catch (e) {
    return false;
  }
}


interface LocationPermissionGuideProps {
  variant?: "light" | "dark";
  onRetry?: () => void;
  showRetry?: boolean;
  /** When true, permission is "denied" and user must enable in settings - Try Again won't help */
  permissionDenied?: boolean;
}

export function LocationPermissionGuide({
  variant = "light",
  onRetry,
  showRetry = true,
  permissionDenied = false
}: LocationPermissionGuideProps) {
  const { t } = useTranslation();
  const [device, setDevice] = useState<DeviceType>("desktop");
  const [browser, setBrowser] = useState<BrowserType>("other");
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    setDevice(detectDevice());
    setBrowser(detectBrowser());
  }, []);

  const handleRefresh = () => {
    setIsRefreshing(true);
    // Simple and reliable - just reload the page
    window.location.reload();
  };

  const handleOpenSettings = () => {
    // Only called on mobile - try to open device settings
    openSettings(device, browser);
  };

  const isDark = variant === "dark";

  const containerClass = isDark
    ? "bg-orange-500/20 border border-orange-500/50 rounded-lg p-3 text-xs text-orange-200"
    : "bg-orange-50 border border-orange-200 rounded-lg p-3 text-xs text-orange-700";

  const titleClass = isDark ? "text-orange-200" : "text-orange-700";
  const listClass = isDark ? "text-orange-300" : "text-orange-600";
  const iconClass = isDark ? "text-orange-300" : "text-orange-600";

  return (
    <div className={containerClass}>
      <p className={`flex items-center gap-1 font-medium mb-2 ${titleClass}`}>
        {device === "desktop" ? (
          <Monitor className="w-3 h-3" />
        ) : (
          <Smartphone className="w-3 h-3" />
        )}
        {t("location.enableTitle", { defaultValue: "To enable location:" })}
      </p>

      {device === "ios" && (
        <div className="space-y-2">
          <p className={`font-medium ${listClass}`}>
            {t("location.iosSafari", { defaultValue: "For Safari:" })}
          </p>
          <ul className={`list-disc list-inside space-y-1 ${listClass}`}>
            <li>{t("location.iosStep1", { defaultValue: "Open Settings app on your device" })}</li>
            <li>{t("location.iosStep2", { defaultValue: "Scroll down and tap Safari (or your browser)" })}</li>
            <li>{t("location.iosStep3", { defaultValue: "Tap Location → Select \"Allow\"" })}</li>
            <li>{t("location.iosStep4", { defaultValue: "Return here and refresh the page" })}</li>
          </ul>
        </div>
      )}

      {device === "android" && (
        <div className="space-y-2">
          <ul className={`list-disc list-inside space-y-1 ${listClass}`}>
            <li>{t("location.androidStep1", { defaultValue: "Tap the ⋮ menu (3 dots) at top right" })}</li>
            <li>{t("location.androidStep2", { defaultValue: "Tap \"Site settings\" or \"Settings\"" })}</li>
            <li>{t("location.androidStep3", { defaultValue: "Tap \"Location\" → Select \"Allow\"" })}</li>
            <li>{t("location.androidStep4", { defaultValue: "Return here and refresh the page" })}</li>
          </ul>
          <p className={`mt-2 text-[10px] ${listClass} opacity-80`}>
            {t("location.androidAlt", { defaultValue: "Or: Device Settings → Apps → Browser → Permissions → Location" })}
          </p>
        </div>
      )}

      {device === "desktop" && (
        <ul className={`list-disc list-inside space-y-1 ${listClass}`}>
          <li>{t("location.desktopStep1", { defaultValue: "Click the lock/info icon in address bar" })}</li>
          <li>{t("location.desktopStep2", { defaultValue: "Find \"Location\" and set to \"Allow\"" })}</li>
          <li>{t("location.desktopStep3", { defaultValue: "Refresh the page" })}</li>
        </ul>
      )}

      {/* Important note: must enable in settings first */}
      <p className={`mt-2 text-[10px] ${listClass} opacity-80 italic`}>
        {t("location.mustEnableFirst", { defaultValue: "⚠️ Enable location in settings first, then click Refresh" })}
      </p>

      <div className="flex flex-col gap-2 mt-3">
        {/* Open Settings button - only show on mobile where it might help */}
        {device !== "desktop" && (
          <button
            type="button"
            onClick={handleOpenSettings}
            className="flex items-center justify-center gap-1 px-3 py-2 text-xs font-medium rounded-md cursor-pointer bg-orange-500 text-white hover:bg-orange-600"
          >
            <Settings className="h-3 w-3" />
            {t("location.openSettings", { defaultValue: "Open Settings" })}
            <ExternalLink className="h-3 w-3" />
          </button>
        )}

        <div className="flex gap-2">
          <button
            type="button"
            disabled={isRefreshing}
            onClick={handleRefresh}
            className={`flex-1 flex items-center justify-center gap-1 px-3 py-2 text-xs font-medium rounded-md border cursor-pointer ${
              isRefreshing
                ? "opacity-50 cursor-wait"
                : isDark
                  ? "border-orange-400/50 text-orange-200 hover:bg-orange-500/20"
                  : "border-orange-300 text-orange-700 hover:bg-orange-100"
            }`}
          >
            {isRefreshing ? (
              <Loader className="h-3 w-3 animate-spin" />
            ) : (
              <RefreshCw className="h-3 w-3" />
            )}
            {isRefreshing
              ? t("location.refreshing", { defaultValue: "Refreshing..." })
              : t("location.refresh", { defaultValue: "Refresh Page" })
            }
          </button>
          {/* Only show Try Again when permission is NOT denied - otherwise it won't help */}
          {showRetry && onRetry && !permissionDenied && (
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onRetry();
              }}
              className={`flex-1 flex items-center justify-center gap-1 px-3 py-2 text-xs font-medium rounded-md border cursor-pointer ${
                isDark
                  ? "border-orange-400/50 text-orange-200 hover:bg-orange-500/20"
                  : "border-orange-300 text-orange-700 hover:bg-orange-100"
              }`}
            >
              <MapPin className="h-3 w-3" />
              {t("location.tryAgain", { defaultValue: "Try Again" })}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
