import { Bell } from "lucide-react";
import { useState, useEffect } from "react";
import { Link, useFetcher } from "react-router";
import { useTranslation } from "react-i18next";
import { useNotifications } from "~/hooks/useNotifications";
import { useNotificationStore, type Notification } from "~/stores/notification.store";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/components/ui/popover";
import { Button } from "~/components/ui/button";

interface NotificationBellProps {
  userType: "model" | "customer";
  initialCount?: number;
  initialNotifications?: Notification[];
}

// Format relative time
function formatRelativeTime(dateString: string, t: (key: string, options?: any) => string) {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 1) return t("modelNotifications.time.justNow");
  if (diffMins < 60) return t("modelNotifications.time.minutesAgo", { count: diffMins });
  if (diffHours < 24) return t("modelNotifications.time.hoursAgo", { count: diffHours });
  if (diffDays < 7) return t("modelNotifications.time.daysAgo", { count: diffDays });

  return date.toLocaleDateString();
}

export function NotificationBell({
  userType,
  initialCount = 0,
  initialNotifications = []
}: NotificationBellProps) {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const fetcher = useFetcher();

  // Detect mobile screen
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 640);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // Use the store directly for reading state
  const { notifications, isConnected, isInitialized, getUnreadCount, markAsRead } = useNotificationStore();

  // Use the hook to handle SSE connection and initialization
  const { addNotifications } = useNotifications({
    userType,
    playSound: true,
  });

  // Initialize with server-loaded notifications only if not already initialized
  useEffect(() => {
    if (!isInitialized && initialNotifications.length > 0) {
      addNotifications(initialNotifications);
    }
  }, [initialNotifications, isInitialized, addNotifications]);

  const notificationsUrl = userType === "model" ? "/model/notifications" : "/customer/notifications";
  const detailBaseUrl = userType === "model" ? "/model/dating/detail" : "/customer/book-service/detail";

  // Calculate display count from store
  const unreadCount = getUnreadCount();
  const displayCount = isInitialized ? unreadCount : initialCount;

  // Get last 5 notifications for preview
  const recentNotifications = notifications.slice(0, 5);

  const handleNotificationClick = (notification: Notification) => {
    // Mark as read in store
    markAsRead(notification.id);

    // Persist to database via API
    fetcher.submit(
      {
        notificationId: notification.id,
        userType
      },
      {
        method: "POST",
        action: "/api/notifications/mark-read"
      }
    );

    setIsOpen(false);
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative h-9 w-9 rounded-full hover:bg-rose-50"
        >
          <Bell className="h-6 w-6 text-gray-600 hover:text-rose-500" />
          {displayCount > 0 && (
            <span className={`absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-rose-500 text-[14px] font-medium text-white ${displayCount > 0 ? "animate-bounce" : ""}`}>
              {displayCount > 99 ? "99+" : displayCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0 ml-4 sm:ml-0" align={isMobile ? "end" : "start"}>
        <div className="flex items-center justify-between p-3">
          <h4 className="font-medium text-sm">{t("modelNotifications.title")}</h4>
          {isConnected && (
            <span className="flex items-center gap-1 text-xs text-emerald-600">
              <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
              {t("modelNotifications.live")}
            </span>
          )}
        </div>
        <div className="max-h-[300px] overflow-y-auto">
          {recentNotifications.length > 0 ? (
            <div className="divide-y">
              {recentNotifications.map((notification) => (
                <Link
                  key={notification.id}
                  to={notification.data?.bookingId ? `${detailBaseUrl}/${notification.data.bookingId}` : notificationsUrl}
                  className={`block p-3 hover:bg-gray-50 transition-colors ${notification.isRead ? "bg-gray-50/50" : "bg-white"
                    }`}
                  onClick={() => handleNotificationClick(notification)}
                >
                  <div className="flex items-start gap-3">
                    <div className={`w-2 h-2 mt-1.5 rounded-full shrink-0 ${notification.isRead ? "bg-gray-300" : "bg-rose-500"
                      }`} />
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-medium truncate ${notification.isRead ? "text-gray-600" : "text-gray-900"
                        }`}>
                        {notification.title}
                      </p>
                      <p className="text-xs text-gray-500 line-clamp-2 mt-0.5">
                        {notification.message}
                      </p>
                      <p className="text-[10px] text-gray-400 mt-1">
                        {formatRelativeTime(notification.createdAt, t)}
                      </p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-8">
              <Bell className="h-10 w-10 text-gray-300 mb-2" />
              <p className="text-sm text-gray-500">{t("modelNotifications.noNotificationsYet")}</p>
            </div>
          )}
        </div>
        <div className="p-2">
          <Link
            to={notificationsUrl}
            className="block w-full text-center text-sm text-rose-600 hover:text-rose-700 py-1"
            onClick={() => setIsOpen(false)}
          >
            {t("modelNotifications.seeAll")}
          </Link>
        </div>
      </PopoverContent>
    </Popover>
  );
}
