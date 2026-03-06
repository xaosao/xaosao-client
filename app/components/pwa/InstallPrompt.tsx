import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { X, Download, Share, Plus } from "lucide-react";
import { Button } from "~/components/ui/button";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

// Check if device is iOS
function isIOS(): boolean {
  if (typeof window === "undefined") return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent);
}

// Check if device is Android
function isAndroid(): boolean {
  if (typeof window === "undefined") return false;
  return /Android/.test(navigator.userAgent);
}

// Check if app is already installed (standalone mode)
function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as any).standalone === true
  );
}

// Check if device is mobile
function isMobileDevice(): boolean {
  if (typeof window === "undefined") return false;
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent
  );
}

const STORAGE_KEY = "pwa-install-prompt-dismissed";

export function InstallPrompt() {
  const { t } = useTranslation();
  const [showPrompt, setShowPrompt] = useState(false);
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [isIOSDevice, setIsIOSDevice] = useState(false);

  useEffect(() => {
    // Only show on mobile devices
    if (!isMobileDevice()) return;

    // Don't show if already installed
    if (isStandalone()) return;

    // Check if user dismissed in this session
    if (sessionStorage.getItem(STORAGE_KEY)) {
      return;
    }

    // Set iOS flag
    setIsIOSDevice(isIOS());

    // For Android/Chrome - listen for beforeinstallprompt
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setShowPrompt(true);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    // Show immediately for both iOS and Android
    setShowPrompt(true);

    return () => {
      window.removeEventListener(
        "beforeinstallprompt",
        handleBeforeInstallPrompt
      );
    };
  }, []);

  const handleInstall = async () => {
    if (deferredPrompt) {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === "accepted") {
        setShowPrompt(false);
      }
      setDeferredPrompt(null);
    }
  };

  const handleDismiss = () => {
    sessionStorage.setItem(STORAGE_KEY, "1");
    setShowPrompt(false);
  };

  if (!showPrompt) return null;

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
            <img
              src="/icons/icon-72x72.png"
              alt="XaoSao"
              className="w-14 h-14 rounded-xl shadow-md"
            />
            <div>
              <h2 className="text-lg font-semibold text-gray-900">XaoSao</h2>
              <p className="text-sm text-gray-500">{t("pwa.installApp")}</p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          <p className="text-sm text-gray-600">
            {t("pwa.description")}
          </p>

          {isIOSDevice ? (
            // iOS Instructions - Share → Add to Home Screen
            <div className="bg-gray-50 rounded-lg p-4 space-y-3">
              <p className="text-sm font-medium text-gray-700">
                {t("pwa.iosTitle")}
              </p>
              <div className="space-y-2">
                <div className="flex items-center gap-3 text-sm text-gray-600">
                  <div className="w-8 h-8 bg-rose-100 rounded-full flex items-center justify-center shrink-0">
                    <Share className="w-4 h-4 text-rose-500" />
                  </div>
                  <span>{t("pwa.iosStep1")}</span>
                </div>
                <div className="flex items-center gap-3 text-sm text-gray-600">
                  <div className="w-8 h-8 bg-rose-100 rounded-full flex items-center justify-center shrink-0">
                    <Plus className="w-4 h-4 text-rose-500" />
                  </div>
                  <span>{t("pwa.iosStep2")}</span>
                </div>
              </div>
            </div>
          ) : deferredPrompt ? (
            // Android - native install available
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <Download className="w-4 h-4" />
                <span>{t("pwa.quickInstall")}</span>
              </div>
            </div>
          ) : (
            // Android - manual install instructions (Chrome menu)
            <div className="bg-gray-50 rounded-lg p-4 space-y-3">
              <p className="text-sm font-medium text-gray-700">
                {t("pwa.androidTitle", { defaultValue: "To install this app:" })}
              </p>
              <div className="space-y-2">
                <div className="flex items-center gap-3 text-sm text-gray-600">
                  <div className="w-8 h-8 bg-rose-100 rounded-full flex items-center justify-center shrink-0">
                    <span className="text-rose-500 font-bold text-lg">⋮</span>
                  </div>
                  <span>{t("pwa.androidStep1", { defaultValue: "Tap the menu button (⋮) in Chrome" })}</span>
                </div>
                <div className="flex items-center gap-3 text-sm text-gray-600">
                  <div className="w-8 h-8 bg-rose-100 rounded-full flex items-center justify-center shrink-0">
                    <Download className="w-4 h-4 text-rose-500" />
                  </div>
                  <span>{t("pwa.androidStep2", { defaultValue: "Select 'Install app' or 'Add to Home screen'" })}</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t flex gap-3">
          <Button
            variant="outline"
            className="flex-1"
            onClick={handleDismiss}
          >
            {t("pwa.notNow")}
          </Button>
          {!isIOSDevice && deferredPrompt ? (
            <Button
              className="flex-1 bg-rose-500 hover:bg-rose-600 text-white"
              onClick={handleInstall}
            >
              <Download className="w-4 h-4 mr-2" />
              {t("pwa.install")}
            </Button>
          ) : (
            <Button
              className="flex-1 bg-rose-500 hover:bg-rose-600 text-white"
              onClick={handleDismiss}
            >
              {t("pwa.gotIt")}
            </Button>
          )}
        </div>

        {/* Safe area padding for iOS */}
        <div className="h-safe-area-inset-bottom" />
      </div>
    </div>
  );
}
