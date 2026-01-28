import { useEffect, useRef } from "react";
import { useNavigate } from "react-router";

interface SubscriptionSSEOptions {
  hasPendingSubscription: boolean;
  onActivated?: (data: { subscriptionId: string; status: string }) => void;
}

export function useSubscriptionSSE({
  hasPendingSubscription,
  onActivated,
}: SubscriptionSSEOptions) {
  const navigate = useNavigate();
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Only connect if customer has pending subscription
    if (!hasPendingSubscription) {
      // Cleanup if subscription is no longer pending
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      return;
    }

    // Connect to SSE endpoint
    const connectSSE = () => {
      try {
        console.log("[SSE Hook] Connecting to subscription events...");
        const eventSource = new EventSource("/api/subscription-events");
        eventSourceRef.current = eventSource;

        // Handle connection opened
        eventSource.addEventListener("open", () => {
          console.log("[SSE Hook] Connected to subscription events");
        });

        // Handle generic messages
        eventSource.addEventListener("message", (event) => {
          try {
            const data = JSON.parse(event.data);
            console.log("[SSE Hook] Received message:", data);

            if (data.type === "connected") {
              console.log("[SSE Hook] Connection confirmed");
            } else if (data.type === "heartbeat") {
              // Heartbeat received, connection is alive
              console.log("[SSE Hook] Heartbeat received");
            } else if (data.type === "timeout") {
              console.log("[SSE Hook] Connection timeout, will reconnect");
              eventSource.close();
              // Reconnect after 5 seconds
              reconnectTimeoutRef.current = setTimeout(connectSSE, 5000);
            }
          } catch (error) {
            console.error("[SSE Hook] Error parsing message:", error);
          }
        });

        // Handle subscription-activated event
        eventSource.addEventListener("subscription-activated", (event) => {
          try {
            const data = JSON.parse(event.data);
            console.log("[SSE Hook] Subscription activated:", data);

            // Show success toast
            const toastMessage = "Your subscription is now active! 🎉";
            const currentUrl = new URL(window.location.href);
            currentUrl.searchParams.set("toastMessage", toastMessage);
            currentUrl.searchParams.set("toastType", "success");

            // Call callback if provided
            if (onActivated) {
              onActivated(data);
            }

            // Close connection
            eventSource.close();

            // Reload page to get fresh subscription data
            window.location.href = currentUrl.toString();
          } catch (error) {
            console.error("[SSE Hook] Error handling subscription-activated:", error);
          }
        });

        // Handle connection errors
        eventSource.addEventListener("error", (error) => {
          console.error("[SSE Hook] SSE error:", error);

          // Close connection
          eventSource.close();

          // Reconnect after 10 seconds if still pending
          if (hasPendingSubscription) {
            console.log("[SSE Hook] Will attempt to reconnect in 10 seconds...");
            reconnectTimeoutRef.current = setTimeout(connectSSE, 10000);
          }
        });
      } catch (error) {
        console.error("[SSE Hook] Error creating EventSource:", error);
      }
    };

    // Initial connection
    connectSSE();

    // Cleanup on unmount or when pending status changes
    return () => {
      console.log("[SSE Hook] Cleaning up SSE connection");

      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }

      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
    };
  }, [hasPendingSubscription, onActivated, navigate]);

  return {
    // Return connection status if needed in the future
    isConnected: !!eventSourceRef.current,
  };
}
