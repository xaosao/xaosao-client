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

// Synchronous support check - can be called during initial render
function checkPushSupport(): boolean {
  try {
    if (typeof window === "undefined") return false;
    return (
      "serviceWorker" in navigator &&
      "PushManager" in window &&
      "Notification" in window
    );
  } catch {
    return false;
  }
}

// Get initial permission synchronously
function getInitialPermission(): NotificationPermission | "default" {
  try {
    if (typeof window === "undefined") return "default";
    if (!("Notification" in window)) return "default";
    return Notification.permission;
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
        // Check if service worker is registered first
        const registrations = await navigator.serviceWorker.getRegistrations();
        console.log("[Push] Service worker registrations:", registrations.length);

        if (registrations.length === 0) {
          console.log("[Push] No service worker registered yet");
          return false;
        }

        const registration = await navigator.serviceWorker.ready;
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
      const isSupported = checkSupport();
      console.log("[Push] Support check:", {
        isSupported,
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

      const permission = Notification.permission;

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
    if (!state.isSupported) {
      setState((prev) => ({
        ...prev,
        error: "Push notifications are not supported",
      }));
      return false;
    }

    setState((prev) => ({ ...prev, isLoading: true, error: null }));

    try {
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

    if (!state.isSupported) {
      console.log("[Push] Not supported");
      setState((prev) => ({
        ...prev,
        error: "Push notifications are not supported",
      }));
      return false;
    }

    setState((prev) => ({ ...prev, isLoading: true, error: null }));

    try {
      // Check/request permission first
      let permission = Notification.permission;
      console.log("[Push] Current permission:", permission);

      if (permission === "default") {
        console.log("[Push] Requesting permission...");
        permission = await Notification.requestPermission();
        console.log("[Push] Permission result:", permission);
        setState((prev) => ({ ...prev, permission }));
      }

      if (permission !== "granted") {
        console.log("[Push] Permission not granted");
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
      const registration = await navigator.serviceWorker.ready;
      console.log("[Push] Service worker ready");

      // Check for existing subscription
      let subscription = await registration.pushManager.getSubscription();
      console.log("[Push] Existing subscription:", !!subscription);

      // Create new subscription if none exists
      if (!subscription) {
        console.log("[Push] Creating new subscription...");
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidKey),
        });
        console.log("[Push] Subscription created:", subscription.endpoint.substring(0, 50) + "...");
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
