/**
 * Delivers xs_backend-created notifications to the browser in realtime.
 *
 * The website already has an SSE stream, but it's fed by an in-process
 * EventEmitter — only this app's OWN Prisma writes can reach it. Notifications
 * created by xs_backend (bookings accepted in the app, gifts, top-ups, admin
 * actions…) never touched that emitter, and FCM push can't reach a browser, so
 * they only appeared after a page reload.
 *
 * The backend now emits `notification:new` on the user's personal socket room
 * for every type, and this hook feeds those into the same store the SSE and
 * loader data use — so the bell badge and dropdown update live regardless of
 * which system created the notification.
 */

import { useCallback, useRef } from "react";
import { useChatSocket } from "./useChatSocket";
import { useNotificationStore } from "~/stores/notification.store";
import { xsDateToIso } from "~/utils/xs-date";

interface Options {
  userType: "customer" | "model";
  /** Play the same chime the SSE path uses. */
  playSound?: boolean;
  onNewNotification?: (type: string) => void;
}

const NOTIFICATION_SOUND_URL = "/sound/messeger.mp3";

export function useBackendNotifications({
  userType,
  playSound = false,
  onNewNotification,
}: Options) {
  const addNotification = useNotificationStore((s) => s.addNotification);
  const onNewRef = useRef(onNewNotification);
  onNewRef.current = onNewNotification;

  const handle = useCallback(
    (payload: Parameters<NonNullable<Parameters<typeof useChatSocket>[0]["onNotification"]>>[0]) => {
      const row = payload?.notification;
      if (!row?.id) return;

      // Ignore anything addressed to the other role — a browser can hold both
      // sessions, and both sockets emit into their own rooms.
      if (payload.userType && payload.userType !== userType) return;

      addNotification({
        id: row.id,
        type: row.type,
        title: row.title,
        message: row.message,
        laTitle: row.la_title || undefined,
        laMessage: row.la_message || undefined,
        data: (row.data ?? {}) as Record<string, any>,
        isRead: !!row.is_read,
        createdAt: xsDateToIso(row.created_at),
      });

      if (playSound && typeof window !== "undefined") {
        try {
          const audio = new Audio(NOTIFICATION_SOUND_URL);
          audio.volume = 0.5;
          // Autoplay is blocked until the user has interacted with the page;
          // that's expected, so swallow it rather than logging an error.
          void audio.play().catch(() => {});
        } catch {
          /* no sound available */
        }
      }

      onNewRef.current?.(row.type);
    },
    [addNotification, playSound, userType]
  );

  useChatSocket({ userType, onNotification: handle });
}
