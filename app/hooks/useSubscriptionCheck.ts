import { useState, useEffect } from "react";
import { useLocation } from "react-router";

interface UseSubscriptionCheckProps {
  hasActiveSubscription: boolean;
  customerBalance: number;
  trialPrice: number;
  trialPlanId: string;
  showOnMount?: boolean;
}

export function useSubscriptionCheck({
  hasActiveSubscription,
  customerBalance,
  trialPrice,
  trialPlanId,
  showOnMount = true,
}: UseSubscriptionCheckProps) {
  const location = useLocation();
  const [showSubscriptionModal, setShowSubscriptionModal] = useState(false);

  // Session storage key to track if modal was shown in current session
  const SESSION_KEY = "subscription_modal_shown";

  // Listen to location changes to check for showSubscription parameter
  useEffect(() => {
    // Only run if there are search params
    if (!location.search) return;

    const urlParams = new URLSearchParams(location.search);
    const shouldShowFromUrl = urlParams.get("showSubscription") === "true";

    // Only show modal if explicitly requested via URL parameter
    if (shouldShowFromUrl && !hasActiveSubscription) {
      setShowSubscriptionModal(true);
      // Remove the parameter from URL after showing
      urlParams.delete("showSubscription");
      const newUrl = location.pathname + (urlParams.toString() ? `?${urlParams.toString()}` : "");
      window.history.replaceState({}, "", newUrl);
    }
  }, [location.search, location.pathname, hasActiveSubscription]);

  // Handle auto-show on dashboard mount
  useEffect(() => {
    // Only check on mount if showOnMount is true (for dashboard)
    if (showOnMount && !hasActiveSubscription) {
      const wasShownInSession = sessionStorage.getItem(SESSION_KEY);

      if (!wasShownInSession) {
        // Show modal after a short delay for better UX
        const timer = setTimeout(() => {
          setShowSubscriptionModal(true);
          sessionStorage.setItem(SESSION_KEY, "true");
        }, 1000);

        return () => clearTimeout(timer);
      }
    }
  }, [hasActiveSubscription, showOnMount]);

  const openSubscriptionModal = () => {
    setShowSubscriptionModal(true);
  };

  const closeSubscriptionModal = () => {
    setShowSubscriptionModal(false);
  };

  const handleSubscribe = async (planId: string) => {
    try {
      const response = await fetch("/customer/subscribe-trial", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ planId }),
      });

      if (!response.ok) {
        throw new Error("Subscription failed");
      }

      const result = await response.json();

      // Clear session flag so modal can show again if needed
      sessionStorage.removeItem(SESSION_KEY);

      // Check for stored booking intent
      const bookingIntent = sessionStorage.getItem("booking_intent");
      if (bookingIntent) {
        const { modelId, serviceId } = JSON.parse(bookingIntent);
        sessionStorage.removeItem("booking_intent");
        // Redirect to booking page
        window.location.href = `/customer/book-service/${modelId}/${serviceId}`;
      } else {
        // Reload to get fresh data
        window.location.reload();
      }

      return result;
    } catch (error) {
      console.error("Subscription error:", error);
      throw error;
    }
  };

  return {
    showSubscriptionModal,
    openSubscriptionModal,
    closeSubscriptionModal,
    handleSubscribe,
  };
}
