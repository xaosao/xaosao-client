import { useEffect } from "react";
import {
  isRouteErrorResponse,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useNavigation,
} from "react-router";

import type { Route } from "./+types/root";
import "./app.css";
import "./i18n/config";
import Toast from "./components/toast";
import { useLanguageInit } from "./hooks/use-language-init";
import { InstallPrompt } from "./components/pwa/InstallPrompt";
import { DebugConsole } from "./components/debug/DebugConsole";
import DevToolsRedirect from "./components/DevToolsRedirect";

// App version - increment this when deploying new versions to force cache refresh
const APP_VERSION = "1.0.11";

// Check if device is mobile
function isMobileDevice(): boolean {
  if (typeof window === "undefined") return false;
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent
  );
}

// Check if Safari browser
function isSafari(): boolean {
  if (typeof window === "undefined") return false;
  const ua = navigator.userAgent;
  return /^((?!chrome|android).)*safari/i.test(ua);
}

// Check if running as iOS PWA
function isIOSPWA(): boolean {
  if (typeof window === "undefined") return false;
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  const isStandalone = window.matchMedia("(display-mode: standalone)").matches ||
                      (window.navigator as any).standalone === true;
  return isIOS && isStandalone;
}

// Check if running as PWA (standalone mode)
function isPWAMode(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(display-mode: standalone)").matches ||
         (window.navigator as any).standalone === true;
}

// Check if iOS device
function isIOS(): boolean {
  if (typeof window === "undefined") return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent);
}

// Clear all caches and optionally reload
async function clearAllCachesAndReload(shouldReload: boolean = true) {
  console.log("[Cache] Clearing all caches...");

  // Clear service worker caches
  if ("caches" in window) {
    const names = await caches.keys();
    console.log("[Cache] Found caches to clear:", names);
    await Promise.all(names.map((name) => caches.delete(name)));
    console.log("[Cache] All caches cleared");
  }

  // Unregister service worker to force fresh install
  if ("serviceWorker" in navigator) {
    const registrations = await navigator.serviceWorker.getRegistrations();
    for (const registration of registrations) {
      await registration.unregister();
      console.log("[Cache] Service worker unregistered");
    }
  }

  // Update stored version
  localStorage.setItem("app_version", APP_VERSION);

  if (shouldReload) {
    console.log("[Cache] Force reloading...");
    // Force reload bypassing cache
    window.location.href = window.location.href.split('?')[0] + '?v=' + Date.now();
  }
}

// Force cache clear when version changes (for Safari and PWA mode)
function useCacheClear() {
  useEffect(() => {
    if (typeof window === "undefined") return;

    const storedVersion = localStorage.getItem("app_version");
    const isPWA = isPWAMode();
    const isSafariBrowser = isSafari();
    const isIOSDevice = isIOS();

    console.log(`[Cache] Version check - stored: ${storedVersion}, current: ${APP_VERSION}, isPWA: ${isPWA}, isSafari: ${isSafariBrowser}, isIOS: ${isIOSDevice}`);

    // If version changed, clear caches and reload
    if (storedVersion && storedVersion !== APP_VERSION) {
      console.log(`[Cache] Version changed from ${storedVersion} to ${APP_VERSION}, clearing caches...`);
      clearAllCachesAndReload(isSafariBrowser || isPWA || isIOSDevice);
      return;
    } else if (!storedVersion) {
      // First time visit, just store the version
      console.log("[Cache] First visit, storing version");
      localStorage.setItem("app_version", APP_VERSION);
    }

    // For PWA mode or iOS, always check service worker for updates on launch
    if ((isPWA || isIOSDevice) && "serviceWorker" in navigator) {
      navigator.serviceWorker.getRegistration().then((registration) => {
        if (registration) {
          console.log("[PWA] Checking for service worker updates...");
          registration.update();
        }
      });
    }

    // For iOS, handle visibility change (when app resumes from background)
    if (isIOSDevice) {
      const handleVisibilityChange = () => {
        if (document.visibilityState === 'visible') {
          console.log("[iOS] App became visible, checking for updates...");

          // Check if version still matches
          const currentStoredVersion = localStorage.getItem("app_version");
          if (currentStoredVersion !== APP_VERSION) {
            console.log("[iOS] Version mismatch on resume, clearing cache...");
            clearAllCachesAndReload(true);
            return;
          }

          // Force service worker update check
          if ("serviceWorker" in navigator) {
            navigator.serviceWorker.getRegistration().then((registration) => {
              if (registration) {
                registration.update();
              }
            });
          }
        }
      };

      document.addEventListener('visibilitychange', handleVisibilityChange);

      // Also handle pageshow event for iOS back-forward cache
      const handlePageShow = (event: PageTransitionEvent) => {
        if (event.persisted) {
          console.log("[iOS] Page restored from bfcache, reloading...");
          window.location.reload();
        }
      };

      window.addEventListener('pageshow', handlePageShow);

      return () => {
        document.removeEventListener('visibilitychange', handleVisibilityChange);
        window.removeEventListener('pageshow', handlePageShow);
      };
    }
  }, []);
}

// Register service worker for all devices (needed for push notifications)
function usePWA() {
  useEffect(() => {
    const registerSW = () => {
      if (!("serviceWorker" in navigator)) {
        console.log("[PWA] Service Worker API not available");
        return;
      }

      console.log("[PWA] Device check:", {
        isMobile: isMobileDevice(),
        isIOSPWA: isIOSPWA(),
        userAgent: navigator.userAgent
      });

      // First, check if there's an existing service worker and clear old caches
      navigator.serviceWorker.getRegistration().then((existingReg) => {
        if (existingReg && existingReg.active) {
          // Send message to clear old caches and force update
          existingReg.active.postMessage({ type: 'FORCE_UPDATE' });
        }
      });

      // Register service worker with updateViaCache: 'none' to always check for updates
      navigator.serviceWorker
        .register("/sw.js", { updateViaCache: 'none' })
        .then((registration) => {
          console.log("[PWA] Service Worker registered:", registration.scope);

          // Check for updates
          registration.update();

          // If there's a waiting worker, activate it
          if (registration.waiting) {
            registration.waiting.postMessage({ type: 'SKIP_WAITING' });
          }

          // Listen for new service worker
          registration.addEventListener('updatefound', () => {
            const newWorker = registration.installing;
            if (newWorker) {
              newWorker.addEventListener('statechange', () => {
                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                  // New version available, activate it immediately
                  newWorker.postMessage({ type: 'SKIP_WAITING' });
                }
              });
            }
          });
        })
        .catch((error) => {
          console.error("[PWA] Service Worker registration failed:", error);
        });

      // Reload page when new service worker takes control
      let refreshing = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (!refreshing) {
          refreshing = true;
          console.log('[PWA] Service worker controller changed, reloading...');
          window.location.reload();
        }
      });

      // Listen for messages from service worker
      navigator.serviceWorker.addEventListener('message', (event) => {
        if (event.data && event.data.type === 'SW_UPDATED') {
          console.log('[PWA] Service worker updated to version:', event.data.version);
          // Clear localStorage cache version to trigger refresh on next load
          localStorage.removeItem('app_version');
        }
      });
    };

    // On iOS PWA, the service worker API might not be immediately available
    // Try immediately, and if not available, retry after a delay
    if ("serviceWorker" in navigator) {
      registerSW();
    } else if (isIOSPWA()) {
      console.log("[PWA] iOS PWA detected but service worker not available, will retry...");
      // Retry after a delay for iOS PWA
      const retryTimeout = setTimeout(() => {
        if ("serviceWorker" in navigator) {
          console.log("[PWA] Service Worker now available on iOS PWA, registering...");
          registerSW();
        } else {
          console.log("[PWA] Service Worker still not available on iOS PWA after retry");
        }
      }, 1000);

      return () => clearTimeout(retryTimeout);
    }
  }, []);
}

function GlobalLoadingIndicator() {
  const navigation = useNavigation();
  const isNavigating = navigation.state === "loading";

  if (!isNavigating) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-[9999]">
      <div className="h-1 w-full bg-rose-100 overflow-hidden">
        <div className="h-full bg-rose-500 animate-loading-bar" />
      </div>
    </div>
  );
}

export const links: Route.LinksFunction = () => [
  { rel: "preconnect", href: "https://fonts.googleapis.com" },
  {
    rel: "preconnect",
    href: "https://fonts.gstatic.com",
    crossOrigin: "anonymous",
  },
  {
    rel: "stylesheet",
    href: "https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,100..900;1,14..32,100..900&display=swap",
  },
  // PWA manifest
  { rel: "manifest", href: "/manifest.json" },
  // PWA icons
  { rel: "apple-touch-icon", sizes: "180x180", href: "/icons/icon-192x192.png" },
  { rel: "icon", type: "image/png", sizes: "32x32", href: "/icons/icon-96x96.png" },
  { rel: "icon", type: "image/png", sizes: "16x16", href: "/icons/icon-72x72.png" },
];

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head suppressHydrationWarning>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover, maximum-scale=1, user-scalable=no" />

        {/* Cache Control - Prevent Safari aggressive caching */}
        <meta httpEquiv="Cache-Control" content="no-cache, no-store, must-revalidate" />
        <meta httpEquiv="Pragma" content="no-cache" />
        <meta httpEquiv="Expires" content="0" />

        {/* PWA Meta Tags */}
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="XaoSao" />
        <meta name="application-name" content="XaoSao" />
        <meta name="theme-color" content="#f43f5e" />
        <meta name="msapplication-TileColor" content="#f43f5e" />
        <meta name="msapplication-tap-highlight" content="no" />
        <meta name="format-detection" content="telephone=no" />

        <Meta />
        <Links />
      </head>
      <body suppressHydrationWarning>
        {children}
        <Toast />
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function App() {
  // Log version on startup for debugging
  useEffect(() => {
    console.log(`[App] XaoSao Version: ${APP_VERSION}`);
    // Also expose to window for easy checking
    if (typeof window !== "undefined") {
      (window as any).__XAOSAO_VERSION__ = APP_VERSION;
    }
  }, []);

  // Initialize language from localStorage after hydration
  useLanguageInit();

  // Clear cache when version changes (Safari + PWA mode)
  useCacheClear();

  // Register PWA service worker on mobile devices
  usePWA();

  return (
    <>
      <DevToolsRedirect />
      <GlobalLoadingIndicator />
      <Outlet />
      <InstallPrompt />
      <DebugConsole />
    </>
  );
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  let message = "Oops!";
  let details = "An unexpected error occurred.";
  let stack: string | undefined;

  if (isRouteErrorResponse(error)) {
    message = error.status === 404 ? "404" : "Error";
    details =
      error.status === 404
        ? "The requested page could not be found."
        : error.statusText || details;
  } else if (import.meta.env.DEV && error && error instanceof Error) {
    details = error.message;
    stack = error.stack;
  }

  return (
    <main className="pt-16 p-4 container mx-auto">
      <h1>{message}</h1>
      <p>{details}</p>
      {stack && (
        <pre className="w-full p-4 overflow-x-auto">
          <code>{stack}</code>
        </pre>
      )}
    </main>
  );
}
