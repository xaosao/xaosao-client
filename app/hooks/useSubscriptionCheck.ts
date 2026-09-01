import { useState, useEffect } from "react";
import { useLocation, useRevalidator } from "react-router";

interface UseSubscriptionCheckProps {
  hasActiveSubscription: boolean;
  hasPendingSubscription: boolean;
  customerBalance: number;
  trialPrice: number;
  trialPlanId: string;
  showOnMount?: boolean;
}

export function useSubscriptionCheck({
  hasActiveSubscription,
  hasPendingSubscription,
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

    // Only show modal if explicitly requested via URL parameter and no active/pending subscription
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
    // Don't show if customer has active or pending subscription
    if (showOnMount && !hasActiveSubscription && !hasPendingSubscription) {
      let wasShownInSession: string | null = null;
      try { wasShownInSession = sessionStorage.getItem(SESSION_KEY); } catch {}

      if (!wasShownInSession) {
        // Show modal after a short delay for better UX
        const timer = setTimeout(() => {
          setShowSubscriptionModal(true);
          try { sessionStorage.setItem(SESSION_KEY, "true"); } catch {}
        }, 1000);

        return () => clearTimeout(timer);
      }
    }
  }, [hasActiveSubscription, hasPendingSubscription, showOnMount]);

  const openSubscriptionModal = () => {
    setShowSubscriptionModal(true);
  };

  const closeSubscriptionModal = () => {
    setShowSubscriptionModal(false);
  };

  const revalidator = useRevalidator();

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
      try { sessionStorage.removeItem(SESSION_KEY); } catch {}

      // Check for stored booking intent
      let bookingIntent: string | null = null;
      try { bookingIntent = sessionStorage.getItem("booking_intent"); } catch {}
      if (bookingIntent) {
        const { modelId, serviceId } = JSON.parse(bookingIntent);
        try { sessionStorage.removeItem("booking_intent"); } catch {}
        // Redirect to booking page
        window.location.href = `/customer/book-service/${modelId}/${serviceId}`;
      } else {
        // Close the modal and re-run the loaders in place.
        //
        // This used to be `window.location.reload()`, which was both jarring
        // and — until the server-side cache was invalidated on subscribe —
        // ineffective: the reloaded layout was served the cached
        // `hasActiveSubscription: false` and the modal came straight back.
        setShowSubscriptionModal(false);
        revalidator.revalidate();
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
    hasPendingSubscription,
  };
}
