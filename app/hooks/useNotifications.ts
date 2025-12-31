import { useEffect, useCallback, useRef, useId } from "react";
import { useNotificationStore, type Notification } from "~/stores/notification.store";

// Re-export the Notification type for convenience
export type { Notification } from "~/stores/notification.store";

interface UseNotificationsOptions {
  userType: "model" | "customer";
  onNewNotification?: (notification: Notification) => void;
  playSound?: boolean;
}

// Notification sound URL
const NOTIFICATION_SOUND_URL = "/sound/messeger.mp3";

// Callback registry - stores all component callbacks per userType
type CallbackEntry = {
  onNewNotification?: (notification: Notification) => void;
  playSound: boolean;
  audioRef: React.MutableRefObject<HTMLAudioElement | null>;
};
const callbackRegistry: Map<string, Map<string, CallbackEntry>> = new Map();

// Global singleton to prevent multiple SSE connections per userType
const activeConnections: Map<string, { eventSource: EventSource; refCount: number }> = new Map();

export function useNotifications({
  userType,
  onNewNotification,
  playSound = true,
}: UseNotificationsOptions) {
  // Unique ID for this component instance
  const componentId = useId();

  const {
    notifications,
    isConnected,
    isInitialized,
    addNotification,
    markAsRead,
    markAllAsRead,
    clearAll,
    setNotifications,
    setConnected,
    getUnreadCount,
  } = useNotificationStore();

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize audio element
  useEffect(() => {
    if (typeof window !== "undefined" && playSound) {
      audioRef.current = new Audio(NOTIFICATION_SOUND_URL);
      audioRef.current.volume = 0.5;
    }

    return () => {
      if (audioRef.current) {
        audioRef.current = null;
      }
    };
  }, [playSound]);

  // Store callback ref for updates
  const onNewNotificationRef = useRef(onNewNotification);
  const addNotificationRef = useRef(addNotification);
  const setConnectedRef = useRef(setConnected);

  // Keep refs updated
  useEffect(() => {
    onNewNotificationRef.current = onNewNotification;
    addNotificationRef.current = addNotification;
    setConnectedRef.current = setConnected;
  });

  // Register this component's callbacks in the registry
  useEffect(() => {
    const connectionKey = userType;

    // Initialize registry for this userType if needed
    if (!callbackRegistry.has(connectionKey)) {
      callbackRegistry.set(connectionKey, new Map());
    }

    // Register this component's callback
    const registry = callbackRegistry.get(connectionKey)!;
    registry.set(componentId, {
      onNewNotification: onNewNotificationRef.current,
      playSound,
      audioRef,
    });

    // Keep the registry entry updated
    const updateInterval = setInterval(() => {
      const entry = registry.get(componentId);
      if (entry) {
        entry.onNewNotification = onNewNotificationRef.current;
      }
    }, 100);

    return () => {
      clearInterval(updateInterval);
      registry.delete(componentId);
      if (registry.size === 0) {
        callbackRegistry.delete(connectionKey);
      }
    };
  }, [userType, componentId, playSound]);

  // Connect to SSE - singleton per userType
  useEffect(() => {
    if (typeof window === "undefined") return;

    const connectionKey = userType;

    // Check if connection already exists
    const existingConnection = activeConnections.get(connectionKey);
    if (existingConnection) {
      // Increment ref count - another component is using this connection
      existingConnection.refCount++;
      return () => {
        existingConnection.refCount--;
        // Only close if no one is using it
        if (existingConnection.refCount <= 0) {
          existingConnection.eventSource.close();
          activeConnections.delete(connectionKey);
          setConnectedRef.current(false);
        }
      };
    }

    const sseUrl =
      userType === "model"
        ? "/api/notifications/model-sse"
        : "/api/notifications/customer-sse";

    const createConnection = () => {
      const eventSource = new EventSource(sseUrl);

      eventSource.onopen = () => {
        setConnectedRef.current(true);
        console.log("SSE connected for", userType);
      };

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          // Ignore heartbeat and connected messages
          if (data.type === "heartbeat" || data.type === "connected") {
            return;
          }

          console.log(`[useNotifications] Received notification:`, data.type, data.title);

          // This is a real notification
          const notification: Notification = {
            id: data.id,
            type: data.type,
            title: data.title,
            message: data.message,
            data: data.data,
            isRead: false,
            createdAt: data.createdAt || new Date().toISOString(),
          };

          // Add to store
          addNotificationRef.current(notification);

          // Call all registered callbacks for this userType
          const registry = callbackRegistry.get(connectionKey);
          console.log(`[useNotifications] Callback registry size for ${connectionKey}:`, registry?.size || 0);

          if (registry) {
            let soundPlayed = false;
            registry.forEach((entry, componentId) => {
              console.log(`[useNotifications] Calling callback for component ${componentId}, hasCallback:`, !!entry.onNewNotification);

              // Play sound only once (from the first component with playSound=true)
              if (entry.playSound && !soundPlayed && entry.audioRef.current) {
                entry.audioRef.current.currentTime = 0;
                entry.audioRef.current.play().catch((err) => {
                  console.log("Could not play notification sound:", err);
                });
                soundPlayed = true;
              }

              // Call the callback
              if (entry.onNewNotification) {
                entry.onNewNotification(notification);
              }
            });
          }
        } catch (error) {
          console.error("Error parsing SSE message:", error);
        }
      };

      eventSource.onerror = () => {
        console.error("SSE error for", userType);
        setConnectedRef.current(false);

        // Clean up and reconnect after delay
        const connection = activeConnections.get(connectionKey);
        if (connection && connection.refCount > 0) {
          connection.eventSource.close();
          activeConnections.delete(connectionKey);

          // Clear any existing reconnect timeout
          if (reconnectTimeoutRef.current) {
            clearTimeout(reconnectTimeoutRef.current);
          }

          // Reconnect after 5 seconds
          reconnectTimeoutRef.current = setTimeout(() => {
            if (activeConnections.get(connectionKey) === undefined) {
              const newConnection = createConnection();
              activeConnections.set(connectionKey, { eventSource: newConnection, refCount: connection.refCount });
            }
          }, 5000);
        }
      };

      return eventSource;
    };

    const eventSource = createConnection();
    activeConnections.set(connectionKey, { eventSource, refCount: 1 });

    return () => {
      // Clear reconnect timeout
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }

      const connection = activeConnections.get(connectionKey);
      if (connection) {
        connection.refCount--;
        // Only close if no one is using it
        if (connection.refCount <= 0) {
          connection.eventSource.close();
          activeConnections.delete(connectionKey);
          setConnectedRef.current(false);
        }
      }
    };
  }, [userType]); // Only depend on userType - callbacks are stored in refs

  // Add notifications from server (for initial load)
  const addNotifications = useCallback((newNotifications: Notification[]) => {
    setNotifications(newNotifications);
  }, [setNotifications]);

  const unreadCount = getUnreadCount();

  return {
    notifications,
    unreadCount,
    isConnected,
    isInitialized,
    markAsRead,
    markAllAsRead,
    clearAll,
    addNotifications,
  };
}
