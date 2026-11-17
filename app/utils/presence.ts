/**
 * "Is this person online right now?" — the browser-side half of the
 * presence rule xs_backend applies.
 *
 * The window and the reasoning are copied from
 *   xs_backend/src/common/utils/presence.util.ts
 * and the two must stay in step: a badge that disagrees with the gate on
 * `POST /calls` is worse than no badge, because the customer taps Call
 * on someone the server then refuses.
 *
 * Always derive from the timestamp. The stored `isOnline` boolean is only
 * ever set to true — nothing flips it back when someone closes the app —
 * so reading it directly shows everyone as permanently online.
 *
 * This is a five-minute window refreshed about once a minute, which makes
 * it right for a list or a badge and too coarse to authorise a call. The
 * exact check is the live socket, which only the backend can see: use
 * `reachable` from `GET /calls/rate/:modelId` at the point of action.
 */

const ONLINE_WINDOW_MS = 5 * 60 * 1000;

export function isOnlineNow(
  lastOnlineAt: Date | string | null | undefined
): boolean {
  if (!lastOnlineAt) return false;
  const ts =
    lastOnlineAt instanceof Date
      ? lastOnlineAt.getTime()
      : new Date(lastOnlineAt).getTime();
  if (Number.isNaN(ts)) return false;
  return Date.now() - ts < ONLINE_WINDOW_MS;
}
