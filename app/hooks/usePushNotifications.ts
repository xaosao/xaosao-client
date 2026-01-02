import { useState, useEffect, useCallback, useRef } from "react";

interface UsePushNotificationsOptions {
  userType: "model" | "customer";
  autoSubscribe?: boolean; // Auto-subscribe after permission granted
}

interface PushNotificationState {
  isSupported: boolean;
  permission: NotificationPermission | "default";
  isSubscribed: boolean;
  isLoading: boolean;
  isInitializing: boolean; // True while checking initial subscription status
  error: string | null;
}

// Convert base64 VAPID key to Uint8Array
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }

  return outputArray;
}

// Global state to track subscription status per user type
const subscriptionStatus: Map<string, boolean> = new Map();

// localStorage key for subscription status
const getSubscriptionStorageKey = (userType: string) => `push-subscription-status-${userType}`;

// Get subscription status from localStorage (synchronous, for quick initial check)
function getStoredSubscriptionStatus(userType: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    const stored = localStorage.getItem(getSubscriptionStorageKey(userType));
    return stored === "true";
  } catch {
    return false;
  }
}

// Store subscription status in localStorage
function setStoredSubscriptionStatus(userType: string, isSubscribed: boolean): void {
  if (typeof window === "undefined") return;
  try {
    if (isSubscribed) {
      localStorage.setItem(getSubscriptionStorageKey(userType), "true");
    } else {
      localStorage.removeItem(getSubscriptionStorageKey(userType));
    }
  } catch {
    // Ignore localStorage errors
  }
}

// Check if this looks like an iOS PWA context
function isIOSPWA(): boolean {
  try {
    if (typeof window === "undefined") return false;
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const isStandalone = window.matchMedia("(display-mode: standalone)").matches ||
                        (window.navigator as any).standalone === true;
    return isIOS && isStandalone;
  } catch {
    return false;
  }
}

// Synchronous support check - can be called during initial render
// Note: On iOS PWA, both PushManager and serviceWorker might not be directly detectable
// but could still work. We return optimistic support for iOS PWA.
function checkPushSupport(): boolean {
  try {
    if (typeof window === "undefined") return false;

    // For iOS PWA, return true optimistically - we'll do the real check when subscribing
    // iOS Safari PWA might not expose serviceWorker/PushManager on navigator/window directly
    // but they become available when actually used
    if (isIOSPWA()) {
      console.log("[Push] iOS PWA detected, returning optimistic support");
      return true;
    }

    // For other browsers, check for service worker
    if (!("serviceWorker" in navigator)) return false;

    // If PushManager is on window, definitely supported
    if ("PushManager" in window) return true;

    return false;
  } catch {
    return false;
  }
}

// Get initial permission synchronously
// Returns "default" if Notification API is not available (some PWA contexts)
function getInitialPermission(): NotificationPermission | "default" {
  try {
    if (typeof window === "undefined") return "default";
    // If Notification API is available, use it
    if ("Notification" in window) {
      return Notification.permission;
    }
    // In some PWA contexts, Notification might not be available
    // Return "default" and let the subscribe function handle it
    return "default";
  } catch {
    return "default";
  }
}

export function usePushNotifications({
  userType,
  autoSubscribe = false,
}: UsePushNotificationsOptions) {
  // Initialize with synchronous checks so components get correct values immediately
  // Use localStorage value for isSubscribed to prevent prompt flashing
  const [state, setState] = useState<PushNotificationState>(() => {
    try {
      const storedSubscription = getStoredSubscriptionStatus(userType);
      console.log("[Push] Initial state from localStorage:", { userType, storedSubscription });
      return {
        isSupported: checkPushSupport(),
        permission: getInitialPermission(),
        isSubscribed: storedSubscription, // Use localStorage value initially
        isLoading: false,
        isInitializing: !storedSubscription, // Skip initialization if already subscribed per localStorage
        error: null,
      };
    } catch (err) {
      console.error("[Push] Error initializing state:", err);
      return {
        isSupported: false,
        permission: "default" as const,
        isSubscribed: false,
        isLoading: false,
        isInitializing: false,
        error: null,
      };
    }
  });

  const vapidKeyRef = useRef<string | null>(null);
  const initializingRef = useRef(false);

  // Check if push notifications are supported
  const checkSupport = useCallback(() => {
    if (typeof window === "undefined") return false;

    // For iOS PWA, return true optimistically
    if (isIOSPWA()) {
      return true;
    }

    const isSupported =
      "serviceWorker" in navigator &&
      "PushManager" in window &&
      "Notification" in window;

    return isSupported;
  }, []);

  // Get VAPID public key from server
  const getVapidKey = useCallback(async (): Promise<string | null> => {
    if (vapidKeyRef.current) return vapidKeyRef.current;

    try {
      const response = await fetch("/api/push/subscribe");
      if (!response.ok) {
        throw new Error("Failed to get VAPID key");
      }
      const data = await response.json();
      vapidKeyRef.current = data.vapidPublicKey;
      return data.vapidPublicKey;
    } catch (error) {
      console.error("[Push] Failed to get VAPID key:", error);
      return null;
    }
  }, []);

  // Check current subscription status with timeout
  const checkSubscription = useCallback(async (): Promise<boolean> => {
    console.log("[Push] Checking subscription status...");
    try {
      // Quick timeout for the whole check
      const timeoutPromise = new Promise<boolean>((resolve) => {
        setTimeout(() => {
          console.log("[Push] Subscription check timed out");
          resolve(false);
        }, 2000);
      });

      const checkPromise = async (): Promise<boolean> => {
        // For iOS PWA, service worker might not be in navigator initially
        if (!("serviceWorker" in navigator)) {
          console.log("[Push] Service worker not in navigator");
          // For iOS PWA, return stored value from localStorage
          return false;
        }

        // Check if service worker is registered first
        const registrations = await navigator.serviceWorker.getRegistrations();
        console.log("[Push] Service worker registrations:", registrations.length);

        if (registrations.length === 0) {
          console.log("[Push] No service worker registered yet");
          return false;
        }

        const registration = await navigator.serviceWorker.ready;

        // For iOS PWA, pushManager might not be available on registration
        if (!registration.pushManager) {
          console.log("[Push] PushManager not available on registration");
          return false;
        }

        const subscription = await registration.pushManager.getSubscription();
        console.log("[Push] Current subscription:", !!subscription);
        return subscription !== null;
      };

      return await Promise.race([checkPromise(), timeoutPromise]);
    } catch (error) {
      console.error("[Push] Failed to check subscription:", error);
      return false;
    }
  }, []);

  // Initialize - check support and permission
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (initializingRef.current) return;

    // If localStorage says subscribed, we trust it initially but still verify in background
    const storedSubscription = getStoredSubscriptionStatus(userType);

    initializingRef.current = true;

    const initialize = async () => {
      const iosPWA = isIOSPWA();
      const isSupported = checkSupport();
      console.log("[Push] Support check:", {
        isSupported,
        iosPWA,
        serviceWorker: "serviceWorker" in navigator,
        pushManager: "PushManager" in window,
        notification: "Notification" in window,
        storedSubscription,
      });

      if (!isSupported) {
        setState((prev) => ({ ...prev, isSupported: false, isInitializing: false }));
        initializingRef.current = false;
        return;
      }

      // Get permission - handle iOS PWA where Notification might not be directly available
      let permission: NotificationPermission = "default";
      if ("Notification" in window) {
        permission = Notification.permission;
      } else {
        // iOS PWA might not have Notification on window, use permissions API
        try {
          const permResult = await navigator.permissions.query({ name: "notifications" as PermissionName });
          permission = permResult.state === "granted" ? "granted" :
                       permResult.state === "denied" ? "denied" : "default";
        } catch {
          // Default to "default" if can't check
          permission = "default";
        }
      }

      // Check subscription status with PushManager
      let isSubscribed = storedSubscription; // Start with localStorage value
      try {
        const actualSubscription = await checkSubscription();
        console.log("[Push] PushManager subscription check:", actualSubscription);

        // If PushManager says not subscribed but localStorage says subscribed,
        // trust PushManager (user may have cleared browser data)
        if (!actualSubscription && storedSubscription) {
          console.log("[Push] localStorage says subscribed but PushManager says no - clearing localStorage");
          setStoredSubscriptionStatus(userType, false);
          isSubscribed = false;
        } else if (actualSubscription) {
          // PushManager confirms subscription
          isSubscribed = true;
          setStoredSubscriptionStatus(userType, true);
        }
      } catch (error) {
        console.log("[Push] Subscription check failed, using localStorage value:", error);
        // Keep localStorage value on error
      }

      console.log("[Push] Initial state:", { permission, isSubscribed, storedSubscription, userType });

      // Update global status
      subscriptionStatus.set(userType, isSubscribed);

      setState((prev) => ({
        ...prev,
        isSupported: true,
        permission,
        isSubscribed,
        isInitializing: false, // Done initializing
      }));

      // Auto-subscribe if permission already granted and not subscribed
      if (autoSubscribe && permission === "granted" && !isSubscribed) {
        // Small delay to ensure state is updated
        setTimeout(() => {
          subscribe();
        }, 100);
      }

      initializingRef.current = false;
    };

    initialize();
  }, [userType, checkSupport, checkSubscription, autoSubscribe]);

  // Request permission
  const requestPermission = useCallback(async (): Promise<boolean> => {
    // Don't fail immediately - try anyway for iOS PWA support
    if (!state.isSupported) {
      console.log("[Push] isSupported is false, but will try requesting permission anyway");
    }

    setState((prev) => ({ ...prev, isLoading: true, error: null }));

    try {
      if (typeof window === "undefined" || !("Notification" in window)) {
        throw new Error("Notifications not available");
      }
      const permission = await Notification.requestPermission();
      setState((prev) => ({ ...prev, permission, isLoading: false }));
      return permission === "granted";
    } catch (error) {
      console.error("[Push] Permission request failed:", error);
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: "Failed to request permission",
      }));
      return false;
    }
  }, [state.isSupported]);

  // Subscribe to push notifications
  const subscribe = useCallback(async (): Promise<boolean> => {
    console.log("[Push] Starting subscription process...");

    // Don't fail immediately if isSupported is false - try anyway
    // This is important for iOS PWA where the initial check might fail
    // but push is actually supported
    if (!state.isSupported) {
      console.log("[Push] isSupported is false, but will try anyway (iOS PWA support)");
    }

    setState((prev) => ({ ...prev, isLoading: true, error: null }));

    try {
      // Check if we're in a valid environment
      if (typeof window === "undefined") {
        throw new Error("Notifications not available in this environment");
      }

      // Detect device/browser for better error messages
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
      const isAndroid = /Android/.test(navigator.userAgent);
      const isStandalone = window.matchMedia("(display-mode: standalone)").matches ||
                          (window.navigator as any).standalone === true;
      const iosPWA = isIOS && isStandalone;
      const hasServiceWorkerAPI = "serviceWorker" in navigator;
      const hasPushManagerOnWindow = "PushManager" in window;

      // Parse iOS version early for logging and error messages
      let iosVersion = "unknown";
      let iosMajor = 0;
      let iosMinor = 0;
      if (isIOS) {
        const match = navigator.userAgent.match(/OS (\d+)_(\d+)/);
        if (match) {
          iosMajor = parseInt(match[1], 10);
          iosMinor = parseInt(match[2], 10);
          iosVersion = `${iosMajor}.${iosMinor}`;
        }
      }

      console.log("[Push] Environment check:", {
        isIOS,
        iosVersion,
        isAndroid,
        isStandalone,
        iosPWA,
        hasServiceWorkerAPI,
        hasPushManagerOnWindow,
        userAgent: navigator.userAgent,
      });

      // On iOS, push ONLY works in Safari PWA (standalone mode)
      if (isIOS && !isStandalone) {
        throw new Error(`On iOS ${iosVersion}, please open this app in Safari and add it to your home screen first. Tap the Share button, then "Add to Home Screen".`);
      }

      // Check iOS version for PWA (must be 16.4+)
      if (iosPWA) {
        if (iosMajor > 0 && (iosMajor < 16 || (iosMajor === 16 && iosMinor < 4))) {
          throw new Error(`Your iOS version (${iosVersion}) doesn't support push notifications. Please update to iOS 16.4 or later.`);
        }
        console.log("[Push] iOS version check passed:", iosVersion);
      }

      // Check if service worker is available (required for push)
      // For iOS PWA, we skip this check and try directly - iOS might not expose it on navigator
      if (!iosPWA && !hasServiceWorkerAPI) {
        throw new Error("Service Worker is not supported in this browser");
      }

      // Try to get/request permission
      // On some PWA contexts, Notification might not be directly available
      // but we can still use push via service worker
      let permission: NotificationPermission = "default";

      if ("Notification" in window) {
        // Standard browser/PWA with Notification API
        permission = Notification.permission;
        console.log("[Push] Current permission:", permission);

        if (permission === "default") {
          console.log("[Push] Requesting permission...");
          permission = await Notification.requestPermission();
          console.log("[Push] Permission result:", permission);
          setState((prev) => ({ ...prev, permission }));
        }
      } else {
        // Fallback: try using permissions API (for some PWA contexts)
        console.log("[Push] Notification API not available, trying permissions API...");
        try {
          const permResult = await navigator.permissions.query({ name: "notifications" as PermissionName });
          permission = permResult.state === "granted" ? "granted" :
                       permResult.state === "denied" ? "denied" : "default";
          console.log("[Push] Permission from permissions API:", permission);

          // If default, we'll try to subscribe anyway and let PushManager handle permission
          if (permission === "default") {
            console.log("[Push] Permission is default, will try subscribing directly...");
            permission = "granted"; // Optimistically proceed - PushManager will prompt
          }
        } catch (permError) {
          console.log("[Push] Permissions API failed, will try subscribing directly:", permError);
          permission = "granted"; // Optimistically proceed
        }
      }

      if (permission === "denied") {
        console.log("[Push] Permission denied");
        setState((prev) => ({
          ...prev,
          isLoading: false,
          error: "Notification permission denied",
        }));
        return false;
      }

      // Get VAPID key
      console.log("[Push] Getting VAPID key...");
      const vapidKey = await getVapidKey();
      if (!vapidKey) {
        console.log("[Push] Failed to get VAPID key");
        setState((prev) => ({
          ...prev,
          isLoading: false,
          error: "Failed to get server configuration",
        }));
        return false;
      }
      console.log("[Push] Got VAPID key:", vapidKey.substring(0, 20) + "...");

      // Get service worker registration
      console.log("[Push] Getting service worker...");
      let registration: ServiceWorkerRegistration;

      // Step 1: Check if serviceWorker API exists
      const swInNavigator = "serviceWorker" in navigator;
      console.log("[Push] Step 1 - serviceWorker in navigator:", swInNavigator);

      if (!swInNavigator) {
        if (iosPWA) {
          // Wait and retry for iOS PWA
          console.log("[Push] iOS PWA: serviceWorker not found, waiting 2 seconds...");
          await new Promise(resolve => setTimeout(resolve, 2000));

          if (!("serviceWorker" in navigator)) {
            console.error("[Push] iOS PWA: serviceWorker still not available after waiting");
            throw new Error("Service worker not available. Make sure you opened the app from your home screen (not Safari). Try: Settings > Safari > Clear History and Website Data, then re-add the app.");
          }
          console.log("[Push] iOS PWA: serviceWorker now available after waiting");
        } else {
          throw new Error("Push notifications are not supported on this device.");
        }
      }

      try {
        // Step 2: Check for existing registrations
        console.log("[Push] Step 2 - Getting existing registrations...");
        const existingRegs = await navigator.serviceWorker.getRegistrations();
        console.log("[Push] Existing service worker registrations:", existingRegs.length);

        // Step 3: Register if needed
        if (existingRegs.length === 0) {
          console.log("[Push] Step 3 - No SW registered, registering /sw.js...");
          try {
            registration = await navigator.serviceWorker.register("/sw.js");
            console.log("[Push] Service worker registered, scope:", registration.scope);
            console.log("[Push] SW state - installing:", !!registration.installing, "waiting:", !!registration.waiting, "active:", !!registration.active);

            // Wait for the service worker to be active
            if (registration.installing) {
              console.log("[Push] Waiting for service worker to install and activate...");
              await new Promise<void>((resolve, reject) => {
                const sw = registration.installing!;
                const checkState = () => {
                  console.log("[Push] SW state changed to:", sw.state);
                  if (sw.state === "activated") {
                    resolve();
                  } else if (sw.state === "redundant") {
                    reject(new Error("Service worker became redundant"));
                  }
                };
                sw.addEventListener("statechange", checkState);
                // Also check if already activated
                if (sw.state === "activated") {
                  resolve();
                }
                // Timeout after 15 seconds
                setTimeout(() => reject(new Error("Service worker installation timeout (15s)")), 15000);
              });
              console.log("[Push] Service worker activated successfully");
            }
          } catch (regError: any) {
            console.error("[Push] Failed to register service worker:", regError);
            throw new Error(`Failed to register service worker: ${regError.message || regError}`);
          }
        } else {
          console.log("[Push] Step 3 - Using existing registration");
        }

        // Step 4: Wait for service worker to be ready
        console.log("[Push] Step 4 - Waiting for service worker to be ready...");
        const readyPromise = navigator.serviceWorker.ready;
        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("Service worker ready timeout (10s)")), 10000)
        );

        registration = await Promise.race([readyPromise, timeoutPromise]);
        console.log("[Push] Service worker ready, scope:", registration.scope);
        console.log("[Push] Registration state:", {
          active: !!registration.active,
          activeState: registration.active?.state,
          installing: !!registration.installing,
          waiting: !!registration.waiting,
          hasPushManager: !!registration.pushManager,
          scope: registration.scope,
        });

        // Step 4b: For iOS PWA, ensure service worker is actively controlling the page
        if (iosPWA && registration.active && registration.active.state !== "activated") {
          console.log("[Push] iOS PWA: Waiting for service worker to fully activate...");
          await new Promise<void>((resolve, reject) => {
            const sw = registration.active!;
            const timeout = setTimeout(() => reject(new Error("SW activation timeout")), 10000);

            if (sw.state === "activated") {
              clearTimeout(timeout);
              resolve();
              return;
            }

            sw.addEventListener("statechange", () => {
              console.log("[Push] SW state changed to:", sw.state);
              if (sw.state === "activated") {
                clearTimeout(timeout);
                resolve();
              }
            });
          });
        }

        // Step 4c: Ensure the page is controlled by the service worker (important for iOS)
        if (iosPWA && !navigator.serviceWorker.controller) {
          console.log("[Push] iOS PWA: Page not controlled by SW, calling clients.claim()...");
          // The SW should call clients.claim() on activate, but we wait a bit
          await new Promise(resolve => setTimeout(resolve, 500));

          if (!navigator.serviceWorker.controller) {
            console.log("[Push] iOS PWA: Still no controller, will try to refresh SW...");
            // Try to force the service worker to take control
            if (registration.active) {
              registration.active.postMessage({ type: 'SKIP_WAITING' });
              await new Promise(resolve => setTimeout(resolve, 500));
            }
          }
          console.log("[Push] iOS PWA: Controller status:", !!navigator.serviceWorker.controller);
        }

      } catch (swError: any) {
        console.error("[Push] Service worker error at step:", swError);
        const errorMsg = swError.message || String(swError);

        if (iosPWA) {
          // Provide specific guidance for iOS PWA
          if (errorMsg.includes("timeout")) {
            throw new Error("Service worker is taking too long. Please close the app completely (swipe up), wait 5 seconds, then reopen from home screen.");
          }
          throw new Error(`Push setup failed: ${errorMsg}. Try closing the app completely and reopening.`);
        }
        throw new Error(`Service worker error: ${errorMsg}`);
      }

      // Step 5: Check if pushManager is available on the registration
      console.log("[Push] Step 5 - Checking pushManager availability...");

      // For iOS PWA, pushManager might not be immediately available
      // Try with retries
      let pushManagerAvailable = !!registration.pushManager;
      let pushManager: PushManager | null = registration.pushManager || null;

      // iOS 18.4+ supports Declarative Web Push - try accessing PushManager differently
      if (!pushManagerAvailable && iosPWA) {
        console.log("[Push] iOS PWA: pushManager not available on registration, trying alternative approaches...");

        // Approach 1: Try accessing through prototype
        try {
          const proto = Object.getPrototypeOf(registration);
          console.log("[Push] Registration prototype:", proto?.constructor?.name);
          console.log("[Push] Registration prototype keys:", proto ? Object.getOwnPropertyNames(proto) : []);

          // Check if pushManager is defined on prototype
          if (proto && 'pushManager' in proto) {
            console.log("[Push] pushManager found in prototype!");
            pushManager = registration.pushManager;
            pushManagerAvailable = !!pushManager;
          }
        } catch (protoError) {
          console.log("[Push] Prototype check failed:", protoError);
        }

        // Approach 2: Try requesting notification permission first (might unlock PushManager)
        if (!pushManagerAvailable && "Notification" in window) {
          console.log("[Push] Trying to request Notification permission to unlock PushManager...");
          try {
            const notifPerm = await Notification.requestPermission();
            console.log("[Push] Notification permission after request:", notifPerm);

            // Re-check pushManager after permission request
            registration = await navigator.serviceWorker.ready;
            pushManagerAvailable = !!registration.pushManager;
            pushManager = registration.pushManager || null;
            console.log("[Push] pushManager after notification permission:", pushManagerAvailable);
          } catch (notifError) {
            console.log("[Push] Notification permission request failed:", notifError);
          }
        }

        // Approach 3: Retry with increasing delays
        if (!pushManagerAvailable) {
          console.log("[Push] iOS PWA: Retrying with delays...");

          for (let attempt = 1; attempt <= 5; attempt++) {
            console.log(`[Push] iOS PWA: Retry attempt ${attempt}/5...`);
            await new Promise(resolve => setTimeout(resolve, 1000 * attempt));

            // Re-fetch the registration
            try {
              registration = await navigator.serviceWorker.ready;
              pushManagerAvailable = !!registration.pushManager;
              pushManager = registration.pushManager || null;

              // Also check window.PushManager
              const windowPushManager = (window as any).PushManager;
              console.log(`[Push] iOS PWA: Attempt ${attempt}:`, {
                registrationPushManager: pushManagerAvailable,
                windowPushManager: !!windowPushManager,
                notificationAPI: "Notification" in window,
              });

              if (pushManagerAvailable) {
                console.log("[Push] iOS PWA: pushManager became available on retry!");
                break;
              }
            } catch (retryError) {
              console.error(`[Push] iOS PWA: Retry ${attempt} failed:`, retryError);
            }
          }
        }

        // Approach 4: Try force re-registering the service worker
        if (!pushManagerAvailable) {
          console.log("[Push] iOS PWA: Trying to re-register service worker...");
          try {
            // Unregister existing service workers
            const existingRegs = await navigator.serviceWorker.getRegistrations();
            for (const reg of existingRegs) {
              await reg.unregister();
              console.log("[Push] Unregistered SW with scope:", reg.scope);
            }

            // Wait a moment
            await new Promise(resolve => setTimeout(resolve, 1000));

            // Re-register
            const newReg = await navigator.serviceWorker.register("/sw.js");
            console.log("[Push] Re-registered SW, scope:", newReg.scope);

            // Wait for activation
            if (newReg.installing) {
              await new Promise<void>((resolve) => {
                const sw = newReg.installing!;
                sw.addEventListener("statechange", () => {
                  if (sw.state === "activated") {
                    resolve();
                  }
                });
                setTimeout(resolve, 10000); // Timeout after 10s
              });
            }

            // Get fresh ready registration
            await new Promise(resolve => setTimeout(resolve, 1000));
            registration = await navigator.serviceWorker.ready;
            pushManagerAvailable = !!registration.pushManager;
            pushManager = registration.pushManager || null;
            console.log("[Push] pushManager after SW re-register:", pushManagerAvailable);
          } catch (reregError) {
            console.error("[Push] SW re-register failed:", reregError);
          }
        }
      }

      if (!pushManagerAvailable) {
        console.error("[Push] pushManager not available on registration");
        console.log("[Push] Registration object keys:", Object.keys(registration));
        console.log("[Push] Registration details:", {
          scope: registration.scope,
          active: !!registration.active,
          activeState: registration.active?.state,
          installing: !!registration.installing,
          waiting: !!registration.waiting,
          updateViaCache: registration.updateViaCache,
        });

        // Extra diagnostics for iOS
        if (iosPWA) {
          console.log("[Push] iOS PWA Diagnostics:", {
            windowPushManager: "PushManager" in window,
            windowNotification: "Notification" in window,
            navigatorPermissions: "permissions" in navigator,
            documentVisibility: document.visibilityState,
            windowFocused: document.hasFocus(),
          });
        }

        if (isIOS && !isStandalone) {
          throw new Error("On iOS, push notifications require adding this app to your home screen first. Open in Safari, tap Share, then 'Add to Home Screen'.");
        } else if (iosPWA) {
          // iOS PWA but push not available - this is likely an iOS bug
          const versionStr = iosVersion !== "unknown" ? iosVersion : "your version";

          // Check if this might be a WKWebView issue (Chrome, Firefox, etc. on iOS)
          const isRealSafari = /Safari/.test(navigator.userAgent) && !/CriOS|FxiOS|OPiOS|EdgiOS/.test(navigator.userAgent);

          if (!isRealSafari) {
            throw new Error("Push notifications only work when added from Safari. Please open this website in Safari (not Chrome or other browsers), then add to home screen.");
          }

          // This is likely an iOS 18.x bug
          throw new Error(`iOS ${versionStr} is not exposing Push API to this app. This appears to be an iOS bug.\n\nPlease try:\n1. Go to Settings > Apps > Safari > Advanced > Feature Flags\n2. Make sure "Notifications" is ON\n3. Restart your iPhone completely\n4. Delete the app from home screen\n5. Clear Safari data (Settings > Apps > Safari > Clear History and Website Data)\n6. Re-add the app from Safari\n\nIf this still doesn't work, please report this bug to Apple.`);
        }
        throw new Error("Push notifications are not supported in this browser");
      }
      console.log("[Push] pushManager is available!");

      // Check for existing subscription
      let subscription = await registration.pushManager.getSubscription();
      console.log("[Push] Existing subscription:", !!subscription);

      // Create new subscription if none exists
      if (!subscription) {
        console.log("[Push] Creating new subscription...");
        try {
          subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(vapidKey),
          });
          console.log("[Push] Subscription created:", subscription.endpoint.substring(0, 50) + "...");
        } catch (subscribeError: any) {
          console.error("[Push] Subscribe failed:", subscribeError);
          if (subscribeError.name === "NotAllowedError") {
            throw new Error("Notification permission was denied. Please enable it in your settings.");
          }
          throw new Error(subscribeError.message || "Failed to subscribe to push notifications");
        }
      }

      // Send subscription to server
      console.log("[Push] Saving to server...");
      const response = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          subscription: subscription.toJSON(),
          userAgent: navigator.userAgent,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error("[Push] Server error:", errorData);
        throw new Error(errorData.error || "Failed to save subscription");
      }

      console.log("[Push] Saved to server successfully!");

      // Update state and localStorage
      subscriptionStatus.set(userType, true);
      setStoredSubscriptionStatus(userType, true);
      setState((prev) => ({
        ...prev,
        isSubscribed: true,
        isLoading: false,
        error: null,
      }));

      console.log("[Push] Successfully subscribed for", userType);
      return true;
    } catch (error) {
      console.error("[Push] Subscription failed:", error);
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : "Subscription failed",
      }));
      return false;
    }
  }, [state.isSupported, getVapidKey, userType]);

  // Unsubscribe from push notifications
  const unsubscribe = useCallback(async (): Promise<boolean> => {
    setState((prev) => ({ ...prev, isLoading: true, error: null }));

    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();

      if (subscription) {
        // Unsubscribe from browser
        await subscription.unsubscribe();

        // Remove from server
        await fetch("/api/push/unsubscribe", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            endpoint: subscription.endpoint,
          }),
        });
      }

      // Update state and localStorage
      subscriptionStatus.set(userType, false);
      setStoredSubscriptionStatus(userType, false);
      setState((prev) => ({
        ...prev,
        isSubscribed: false,
        isLoading: false,
        error: null,
      }));

      console.log("[Push] Successfully unsubscribed");
      return true;
    } catch (error) {
      console.error("[Push] Unsubscribe failed:", error);
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : "Unsubscribe failed",
      }));
      return false;
    }
  }, [userType]);

  // Remove all subscriptions for current user
  const unsubscribeAll = useCallback(async (): Promise<boolean> => {
    setState((prev) => ({ ...prev, isLoading: true, error: null }));

    try {
      // Unsubscribe locally first
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();

      if (subscription) {
        await subscription.unsubscribe();
      }

      // Remove all from server
      await fetch("/api/push/unsubscribe", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          removeAll: true,
        }),
      });

      // Update state and localStorage
      subscriptionStatus.set(userType, false);
      setStoredSubscriptionStatus(userType, false);
      setState((prev) => ({
        ...prev,
        isSubscribed: false,
        isLoading: false,
        error: null,
      }));

      console.log("[Push] Successfully removed all subscriptions");
      return true;
    } catch (error) {
      console.error("[Push] Unsubscribe all failed:", error);
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error:
          error instanceof Error ? error.message : "Failed to remove subscriptions",
      }));
      return false;
    }
  }, [userType]);

  return {
    ...state,
    requestPermission,
    subscribe,
    unsubscribe,
    unsubscribeAll,
  };
}
