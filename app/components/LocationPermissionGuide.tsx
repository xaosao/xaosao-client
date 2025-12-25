import { Settings, Smartphone, Monitor, RefreshCw, MapPin } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

type DeviceType = "ios" | "android" | "desktop";

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

// Direct geolocation request - bypasses React state management
// This ensures the geolocation call happens immediately on user gesture
function requestLocationDirect() {
  if (typeof navigator !== "undefined" && navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      () => {
        // Success - reload page to get location
        window.location.reload();
      },
      () => {
        // Error - reload anyway to update state
        window.location.reload();
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  }
}

interface LocationPermissionGuideProps {
  variant?: "light" | "dark";
  onRetry?: () => void;
  showRetry?: boolean;
}

export function LocationPermissionGuide({
  variant = "light",
  onRetry,
  showRetry = true
}: LocationPermissionGuideProps) {
  const { t } = useTranslation();
  const [device, setDevice] = useState<DeviceType>("desktop");

  useEffect(() => {
    setDevice(detectDevice());
  }, []);

  const handleRefresh = () => {
    window.location.reload();
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

      <div className="flex gap-2 mt-3">
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            handleRefresh();
          }}
          className={`flex-1 flex items-center justify-center gap-1 px-3 py-2 text-xs font-medium rounded-md border cursor-pointer ${
            isDark
              ? "border-orange-400/50 text-orange-200 hover:bg-orange-500/20"
              : "border-orange-300 text-orange-700 hover:bg-orange-100"
          }`}
        >
          <RefreshCw className="h-3 w-3" />
          {t("location.refresh", { defaultValue: "Refresh Page" })}
        </button>
        {showRetry && (
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              // Use direct geolocation call for mobile compatibility
              // This bypasses React's callback wrapper which can lose user gesture context
              requestLocationDirect();
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
  );
}
