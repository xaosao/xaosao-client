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

// Check if device is mobile
function isMobileDevice(): boolean {
  if (typeof window === "undefined") return false;
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent
  );
}

// Register service worker for all devices (needed for push notifications)
function usePWA() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    console.log("[PWA] Device check:", { isMobile: isMobileDevice(), userAgent: navigator.userAgent });

    // First, check if there's an existing service worker and clear old caches
    navigator.serviceWorker.getRegistration().then((existingReg) => {
      if (existingReg && existingReg.active) {
        // Send message to clear old caches and force update
        existingReg.active.postMessage({ type: 'FORCE_UPDATE' });
      }
    });

    navigator.serviceWorker
      .register("/sw.js")
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
        window.location.reload();
      }
    });
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
  // Initialize language from localStorage after hydration
  useLanguageInit();

  // Register PWA service worker on mobile devices
  usePWA();

  return (
    <>
      <GlobalLoadingIndicator />
      <Outlet />
      <InstallPrompt />
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
