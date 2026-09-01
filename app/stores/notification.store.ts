import { create } from "zustand";

export interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  /**
   * Lao copy resolved by xs_backend from its notification-text table. Present
   * on rows fetched through the notification API (the same text the mobile app
   * renders); absent on rows pushed over the website's SSE stream. Use
   * `localizeNotification()` rather than reading these directly.
   */
  laTitle?: string;
  laMessage?: string;
  data?: Record<string, any>;
  isRead?: boolean;
  createdAt: string;
}

/**
 * Pick the right language for a notification. The backend only ships English
 * + Lao, so any other UI language falls back to English.
 */
export function localizeNotification(
  notification: Notification,
  language: string
): { title: string; message: string } {
  if (language?.startsWith("lo")) {
    return {
      title: notification.laTitle || notification.title,
      message: notification.laMessage || notification.message,
    };
  }
  return { title: notification.title, message: notification.message };
}

interface NotificationState {
  // State
  notifications: Notification[];
  isConnected: boolean;
  isInitialized: boolean;

  // Actions
  setNotifications: (notifications: Notification[]) => void;
  addNotification: (notification: Notification) => void;
  markAsRead: (notificationId: string) => void;
  markAllAsRead: () => void;
  clearAll: () => void;
  setConnected: (connected: boolean) => void;
  setInitialized: (initialized: boolean) => void;

  // Computed
  getUnreadCount: () => number;
}

export const useNotificationStore = create<NotificationState>((set, get) => ({
  // Initial state
  notifications: [],
  isConnected: false,
  isInitialized: false,

  // Actions
  setNotifications: (notifications) => {
    set({ notifications, isInitialized: true });
  },

  addNotification: (notification) => {
    set((state) => ({
      notifications: [notification, ...state.notifications.filter(n => n.id !== notification.id)],
    }));
  },

  markAsRead: (notificationId) => {
    set((state) => ({
      notifications: state.notifications.map((n) =>
        n.id === notificationId ? { ...n, isRead: true } : n
      ),
    }));
  },

  markAllAsRead: () => {
    set((state) => ({
      notifications: state.notifications.map((n) => ({ ...n, isRead: true })),
    }));
  },

  clearAll: () => {
    set({ notifications: [] });
  },

  setConnected: (connected) => {
    set({ isConnected: connected });
  },

  setInitialized: (initialized) => {
    set({ isInitialized: initialized });
  },

  // Computed
  getUnreadCount: () => {
    return get().notifications.filter((n) => !n.isRead).length;
  },
}));
