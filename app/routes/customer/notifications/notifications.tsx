import {
  Bell,
  Calendar,
  Check,
  CheckCircle2,
  CreditCard,
  MapPin,
  MessageCircle,
  XCircle,
  ChevronRight,
  Heart,
  Users,
  UserPlus,
  UserCheck,
  MessageSquare,
  Eye,
  BadgeCheck,
  Wallet,
  Sparkles,
} from "lucide-react";
import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useFetcher, type LoaderFunction } from "react-router";

import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";

// services and hooks
import { requireUserSession } from "~/services/auths.server";
import {
  getCustomerNotifications,
  getCustomerUnreadCount,
  markAllCustomerNotificationsAsRead,
} from "~/services/notification.server";
import { useNotificationStore, type Notification } from "~/stores/notification.store";
import { useNotifications } from "~/hooks/useNotifications";

interface LoaderReturn {
  notifications: Notification[];
  unreadCount: number;
}

interface PageProps {
  loaderData: LoaderReturn;
}

export const loader: LoaderFunction = async ({ request }) => {
  const customerId = await requireUserSession(request);

  const notifications = await getCustomerNotifications(customerId);
  const unreadCount = await getCustomerUnreadCount(customerId);

  return {
    notifications: notifications.map((n) => ({
      id: n.id,
      type: n.type,
      title: n.title,
      message: n.message,
      data: n.data as Record<string, any>,
      isRead: n.isRead,
      createdAt: n.createdAt.toISOString(),
    })),
    unreadCount,
  };
};

export async function action({ request }: { request: Request }) {
  const customerId = await requireUserSession(request);
  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "markAllRead") {
    await markAllCustomerNotificationsAsRead(customerId);
  }

  return { success: true };
}

// Get icon for notification type
function getNotificationIcon(type: string, isRead: boolean) {
  switch (type) {
    // Booking notifications
    case "booking_created":
      return <Calendar className={`h-4 w-4 ${isRead ? "text-gray-400" : "text-blue-500"}`} />;
    case "booking_confirmed":
      return <CheckCircle2 className={`h-4 w-4 ${isRead ? "text-gray-400" : "text-emerald-500"}`} />;
    case "booking_rejected":
    case "booking_cancelled":
      return <XCircle className={`h-4 w-4 ${isRead ? "text-gray-400" : "text-red-500"}`} />;
    case "booking_checkin_model":
      return <MapPin className={`h-4 w-4 ${isRead ? "text-gray-400" : "text-purple-500"}`} />;
    case "booking_completed":
    case "booking_confirmed_completion":
      return <Check className={`h-4 w-4 ${isRead ? "text-gray-400" : "text-emerald-500"}`} />;
    case "payment_released":
    case "payment_refunded":
      return <CreditCard className={`h-4 w-4 ${isRead ? "text-gray-400" : "text-green-500"}`} />;
    case "booking_disputed":
      return <MessageCircle className={`h-4 w-4 ${isRead ? "text-gray-400" : "text-orange-500"}`} />;
    // Social/Matching notifications
    case "like_received":
      return <Heart className={`h-4 w-4 ${isRead ? "text-gray-400" : "text-rose-500"}`} />;
    case "match_new":
      return <Users className={`h-4 w-4 ${isRead ? "text-gray-400" : "text-pink-500"}`} />;
    case "friend_request":
      return <UserPlus className={`h-4 w-4 ${isRead ? "text-gray-400" : "text-blue-500"}`} />;
    case "friend_accepted":
      return <UserCheck className={`h-4 w-4 ${isRead ? "text-gray-400" : "text-emerald-500"}`} />;
    // Chat notifications
    case "new_message":
      return <MessageSquare className={`h-4 w-4 ${isRead ? "text-gray-400" : "text-indigo-500"}`} />;
    // Profile notifications
    case "profile_viewed":
      return <Eye className={`h-4 w-4 ${isRead ? "text-gray-400" : "text-cyan-500"}`} />;
    case "profile_verified":
      return <BadgeCheck className={`h-4 w-4 ${isRead ? "text-gray-400" : "text-emerald-500"}`} />;
    // Transaction notifications
    case "deposit_approved":
      return <Wallet className={`h-4 w-4 ${isRead ? "text-gray-400" : "text-green-500"}`} />;
    case "deposit_rejected":
      return <Wallet className={`h-4 w-4 ${isRead ? "text-gray-400" : "text-red-500"}`} />;
    // System notifications
    case "welcome":
      return <Sparkles className={`h-4 w-4 ${isRead ? "text-gray-400" : "text-amber-500"}`} />;
    default:
      return <Bell className={`h-4 w-4 ${isRead ? "text-gray-400" : "text-gray-500"}`} />;
  }
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

export default function CustomerNotifications({ loaderData }: PageProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const fetcher = useFetcher();
  const { notifications: serverNotifications } = loaderData;
  const [visibleCount, setVisibleCount] = useState(10);

  // Use the store directly for state
  const {
    notifications,
    isConnected,
    isInitialized,
    getUnreadCount,
    markAsRead,
    markAllAsRead,
  } = useNotificationStore();

  const { addNotifications } = useNotifications({
    userType: "customer",
    playSound: true,
  });

  useEffect(() => {
    if (!isInitialized && serverNotifications.length > 0) {
      addNotifications(serverNotifications);
    }
  }, [serverNotifications, isInitialized, addNotifications]);

  const unreadCount = getUnreadCount();
  const visibleNotifications = notifications.slice(0, visibleCount);
  const hasMore = notifications.length > visibleCount;

  const handleLoadMore = () => {
    setVisibleCount((prev) => prev + 20);
  };

  const handleNotificationClick = (notification: Notification) => {
    markAsRead(notification.id);

    fetcher.submit(
      {
        notificationId: notification.id,
        userType: "customer"
      },
      {
        method: "POST",
        action: "/api/notifications/mark-read"
      }
    );

    if (notification.data?.bookingId) {
      navigate(`/customer/book-service/detail/${notification.data.bookingId}`);
    }
  };

  const handleMarkAllAsRead = () => {
    markAllAsRead();
  };

  return (
    <div className="max-w-4xl mx-auto min-h-screen bg-gray-50 sm:bg-white">
      <div className="sticky top-0 z-10 bg-white border-b px-4 sm:px-8 py-4 sm:py-6">
        <div className="flex items-center justify-between max-w-4xl mx-auto">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-rose-100 rounded-full">
              <Bell className="h-4 w-4 text-rose-500" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-md sm:text-lg font-semibold text-gray-900">
                  {t("modelNotifications.title")}
                </h1>
                {unreadCount > 0 && (
                  <Badge className="bg-rose-500 text-white text-xs px-2 py-0.5">
                    {unreadCount} {t("modelNotifications.new")}
                  </Badge>
                )}
              </div>
              <p className="text-xs sm:text-sm text-gray-500">
                {t("modelNotifications.subtitle")}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {isConnected && (
              <span className="hidden sm:flex items-center gap-1.5 text-xs text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full">
                <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                {t("modelNotifications.live")}
              </span>
            )}
            {unreadCount > 0 && (
              <form method="post">
                <input type="hidden" name="intent" value="markAllRead" />
                <Button
                  type="submit"
                  variant="outline"
                  size="sm"
                  className="text-xs sm:text-sm text-rose-600 border-rose-200 hover:bg-rose-50"
                  onClick={handleMarkAllAsRead}
                >
                  {t("modelNotifications.markAllRead")}
                </Button>
              </form>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto">
        {notifications.length > 0 ? (
          <div className="bg-white sm:bg-transparent">
            {visibleNotifications.map((notification, index) => (
              <div
                key={notification.id}
                className={`
                  flex items-center gap-4 px-2 sm:px-4 py-4 sm:py-5 cursor-pointer
                  transition-colors hover:bg-gray-50
                  ${!notification.isRead ? "bg-rose-50/50 sm:bg-rose-50/30" : ""}
                  ${index !== visibleNotifications.length - 1 ? "border-b border-gray-100" : ""}
                `}
                onClick={() => handleNotificationClick(notification)}
              >
                <div className="flex-shrink-0 w-2">
                  {!notification.isRead && (
                    <div className="w-2 h-2 bg-rose-500 rounded-full" />
                  )}
                </div>

                <div className={`
                  flex-shrink-0 p-2 rounded-full
                  ${notification.isRead ? "bg-gray-100" : "bg-gray-100 shadow-sm"}
                `}>
                  {getNotificationIcon(notification.type, !!notification.isRead)}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-start gap-2">
                    <h3 className={`
                    text-sm sm:text-base font-medium truncate
                    ${notification.isRead ? "text-gray-500" : "text-gray-900"}
                  `}>
                      {notification.title}
                    </h3>
                    <p className="text-[10px] sm:text-xs text-gray-400">
                      {formatRelativeTime(notification.createdAt, t)}
                    </p>
                  </div>
                  <p className={`
                    text-xs sm:text-sm mt-0.5 line-clamp-2
                    ${notification.isRead ? "text-gray-400" : "text-gray-600"}
                  `}>
                    {notification.message}
                  </p>
                </div>

                <ChevronRight className={`
                  flex-shrink-0 h-5 w-5
                  ${notification.isRead ? "text-gray-500" : "text-gray-500"}
                `} />
              </div>
            ))}
            {hasMore && (
              <div className="py-4 text-center">
                <Button
                  variant="outline"
                  size="sm"
                  className="text-rose-600 border-rose-200 hover:bg-rose-50"
                  onClick={handleLoadMore}
                >
                  {t("modelNotifications.loadMore")}
                </Button>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-20 px-4">
            <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Bell className="h-10 w-10 text-gray-300" />
            </div>
            <h3 className="text-gray-800 font-medium text-lg mb-2">{t("modelNotifications.noNotifications")}</h3>
            <p className="text-gray-500 text-sm sm:text-base">
              {t("modelNotifications.noNotificationsDescription")}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
