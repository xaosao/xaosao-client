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
const APP_VERSION = "1.0.14";

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

// Force cache clear when version changes
function useCacheClear() {
  useEffect(() => {
    if (typeof window === "undefined") return;

    const storedVersion = localStorage.getItem("app_version");
    const lastCacheClear = localStorage.getItem("last_cache_clear");
    const now = Date.now();

    console.log(`[Cache] Version check - stored: ${storedVersion}, current: ${APP_VERSION}`);

    // If version changed, clear caches (but don't auto-reload to avoid loops)
    if (storedVersion && storedVersion !== APP_VERSION) {
      console.log(`[Cache] Version changed from ${storedVersion} to ${APP_VERSION}, clearing caches...`);

      // Clear caches without reload
      if ("caches" in window) {
        caches.keys().then((names) => {
          console.log("[Cache] Clearing caches:", names);
          Promise.all(names.map((name) => caches.delete(name)));
        });
      }

      // Update stored version and clear timestamp
      localStorage.setItem("app_version", APP_VERSION);
      localStorage.setItem("last_cache_clear", now.toString());

      // Unregister old service workers
      if ("serviceWorker" in navigator) {
        navigator.serviceWorker.getRegistrations().then((registrations) => {
          for (const registration of registrations) {
            registration.unregister();
            console.log("[Cache] Service worker unregistered");
          }
        });
      }
    } else if (!storedVersion) {
      // First time visit, just store the version
      console.log("[Cache] First visit, storing version");
      localStorage.setItem("app_version", APP_VERSION);
      localStorage.setItem("last_cache_clear", now.toString());
    }

    // iOS-specific: Periodic cache clear every 24 hours to prevent stale cache buildup
    if (isIOSPWA() && lastCacheClear) {
      const hoursSinceLastClear = (now - parseInt(lastCacheClear)) / (1000 * 60 * 60);
      if (hoursSinceLastClear >= 24) {
        console.log("[Cache] iOS PWA: 24 hours passed, clearing caches...");
        if ("caches" in window) {
          caches.keys().then((names) => {
            Promise.all(names.map((name) => caches.delete(name))).then(() => {
              localStorage.setItem("last_cache_clear", now.toString());
              console.log("[Cache] iOS PWA: Cache cleared successfully");
            });
          });
        }
      }
    }

    // Check for service worker updates on launch
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.getRegistration().then((registration) => {
        if (registration) {
          console.log("[PWA] Checking for service worker updates...");
          registration.update();
        }
      });
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

  // Log error for debugging
  console.error("[ErrorBoundary] Error occurred:", error);

  // Handle reload action
  const handleReload = () => {
    // 1. Clear all browser caches
    if ("caches" in window) {
      caches.keys().then((names) => {
        names.forEach((name) => caches.delete(name));
      });
    }

    // 2. Clear localStorage
    localStorage.clear();

    // 3. Clear sessionStorage
    sessionStorage.clear();

    // 4. Clear all cookies (including auth tokens)
    document.cookie.split(";").forEach((cookie) => {
      const name = cookie.split("=")[0].trim();
      document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
      // Also clear with domain for production
      document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=.xaosao.com;`;
    });

    // 5. Unregister service workers and navigate to home
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.getRegistrations().then((registrations) => {
        Promise.all(registrations.map((reg) => reg.unregister())).then(() => {
          window.location.href = "/"; // Force navigate to home
        });
      });
    } else {
      window.location.href = "/";
    }
  };

  const handleGoHome = () => {
    window.location.href = "/";
  };

  return (
    <main className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-rose-50 to-purple-50">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center">
        <div className="w-20 h-20 mx-auto mb-6 bg-rose-100 rounded-full flex items-center justify-center">
          <svg
            className="w-10 h-10 text-rose-500"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
        </div>

        <h1 className="text-2xl font-bold text-gray-900 mb-2">{message}</h1>
        <p className="text-gray-600 mb-6">{details}</p>

        {stack && (
          <details className="mb-6 text-left">
            <summary className="cursor-pointer text-sm text-rose-600 hover:text-rose-700 mb-2">
              Show error details
            </summary>
            <pre className="text-xs bg-gray-100 p-3 rounded-lg overflow-x-auto">
              <code>{stack}</code>
            </pre>
          </details>
        )}

        <div className="space-y-3">
          <button
            onClick={handleReload}
            className="w-full bg-rose-500 hover:bg-rose-600 text-white font-medium py-3 px-6 rounded-lg transition-colors duration-200 flex items-center justify-center gap-2"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
            Clear Cache & Reload
          </button>

          <button
            onClick={handleGoHome}
            className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium py-3 px-6 rounded-lg transition-colors duration-200"
          >
            Go to Home
          </button>
        </div>

        <p className="text-xs text-gray-500 mt-6">
          If this issue persists, try closing and reopening the app.
        </p>
      </div>
    </main>
  );
}
