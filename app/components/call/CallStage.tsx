import { useEffect, useRef, useState } from "react";
import { useFetcher, useNavigate } from "react-router";
import { useTranslation } from "react-i18next";
import {
  Mic,
  MicOff,
  PhoneOff,
  User,
  Video,
  VideoOff,
  Wifi,
  WifiOff,
} from "lucide-react";

import { useLiveKitCall } from "~/hooks/useLiveKitCall";
import type { CallState, CallToken } from "~/services/call.server";

/**
 * How long a call survives this screen unmounting before it is hung up.
 *
 * Long enough that a remount (React re-creating the route element after a
 * revalidation) is not mistaken for the customer leaving, short enough
 * that a customer who really left is not locked out of calling again.
 */
const REMOUNT_GRACE_MS = 1500;

/** Pending hang-ups by call id, so a remount can cancel its own. */
const leavingTimers = new Map<string, ReturnType<typeof setTimeout>>();

/**
 * The in-call screen, shared by both sides.
 *
 * The two differ only in what the number on screen means — the customer
 * is watching money leave, the model is watching it arrive — so they get
 * the same component with a different label.
 *
 * It owns no billing logic. The timer and the amount are whatever the
 * server last said, polled while the call runs, because the server's
 * meter is the one that charges.
 */
export function CallStage({
  call,
  initialState,
  viewer,
  peerName,
  peerPhoto,
  summaryPath,
}: {
  call: CallToken;
  initialState: CallState | null;
  viewer: "customer" | "model";
  peerName: string;
  peerPhoto?: string | null;
  /** Where to go once the call has ended and settled. */
  summaryPath: string;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const poll = useFetcher<{ state: CallState | null }>();
  const action = useFetcher<{ ok?: boolean; error?: string }>();

  const [state, setState] = useState<CallState | null>(initialState);
  const endedRef = useRef(false);

  const media = useLiveKitCall({
    serverUrl: call.server_url,
    token: call.token,
    video: call.call_type === "video",
    // The room closing is not proof the call is over — the server
    // decides that — so ask rather than assume.
    onDisconnected: () => poll.load(`/api/call/session?sessionId=${call.session_id}`),
  });

  // The server's meter, every three seconds. Cheap, and it means a call
  // the server ended (out of funds, other side hung up) leaves this
  // screen without waiting for a socket.
  useEffect(() => {
    const id = setInterval(() => {
      if (endedRef.current) return;
      poll.load(`/api/call/session?sessionId=${call.session_id}`);
    }, 3000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [call.session_id]);

  useEffect(() => {
    const next = poll.data?.state;
    if (!next) return;
    setState(next);

    if (next.status === "ended" && !endedRef.current) {
      endedRef.current = true;
      void media.leave();
      navigate(summaryPath, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [poll.data]);

  function hangUp() {
    endedRef.current = true;
    void media.leave();
    const form = new FormData();
    form.set("intent", "hangup");
    form.set("sessionId", call.session_id);
    action.submit(form, { method: "post", action: "/api/call/session" });
  }

  /**
   * Leaving this screen ends the call.
   *
   * Without this, a customer who pressed back, closed the tab, or gave up
   * because the connection failed left the call ringing on the server.
   * It holds their money and blocks the next attempt — the second tap
   * answers "You are already on a call" — until the 45-second sweep
   * catches it. The money was always safe, but the person was locked out
   * of their own wallet for no reason.
   *
   * The delay is not politeness: this component remounts during normal
   * operation (a revalidation after the call is placed is enough), and a
   * hang-up fired straight from the cleanup killed calls that were still
   * being set up. So the cleanup only *schedules* the hang-up, and a
   * remount for the same call cancels it. A real departure has nothing
   * left to cancel it, so it goes through.
   */
  useEffect(() => {
    const sessionId = call.session_id;
    const pending = leavingTimers.get(sessionId);
    if (pending !== undefined) {
      clearTimeout(pending);
      leavingTimers.delete(sessionId);
    }

    const body = () => {
      const form = new FormData();
      form.set("intent", "hangup");
      form.set("sessionId", sessionId);
      return form;
    };

    // The page itself going away cannot wait for a timer, and a normal
    // request would be cancelled with it, so that case beacons at once.
    const onPageHide = () => {
      if (endedRef.current) return;
      endedRef.current = true;
      try {
        navigator.sendBeacon("/api/call/session", body());
      } catch {
        // Without sendBeacon the 45-second sweep still catches it.
      }
    };
    window.addEventListener("pagehide", onPageHide);

    return () => {
      window.removeEventListener("pagehide", onPageHide);
      if (endedRef.current) return;
      const timer = setTimeout(() => {
        leavingTimers.delete(sessionId);
        void fetch("/api/call/session", {
          method: "POST",
          body: body(),
          keepalive: true,
        }).catch(() => {});
      }, REMOUNT_GRACE_MS);
      leavingTimers.set(sessionId, timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [call.session_id]);

  useEffect(() => {
    if (action.data && (action.data as any).ok !== false) {
      navigate(summaryPath, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [action.data]);

  const ringing = !media.remoteJoined && state?.status !== "active";

  /**
   * A clock that ticks every second between server polls.
   *
   * The server's meter is still the only thing that decides money, but
   * it is asked every three seconds, so the timer used to jump 00:00 →
   * 00:03 → 00:06. Here the last server reading is the anchor and the
   * seconds in between are counted locally, which makes the display
   * move once a second without inventing any billing.
   */
  const [tick, setTick] = useState(0);
  const anchor = useRef<{ at: number; elapsed: number } | null>(null);
  /** The last figure actually shown, so the clock never goes backwards. */
  const shown = useRef({ session: "", seconds: 0 });

  // Re-anchor on the status too, not only on the number. While the call
  // was still ringing the server kept reporting 0, so the anchor was
  // never refreshed; the moment it went active the local clock counted
  // from the ringing time and showed a figure far ahead of the server,
  // which then snapped back on the next poll.
  useEffect(() => {
    if (typeof state?.elapsed_seconds !== "number") return;
    // Re-anchor from whichever is further along: the server's reading or
    // what the screen already shows. Anchoring blindly on the server
    // made the clock sit still for a second or two at the start of a
    // call, because the poll is behind and the display may not go back.
    anchor.current = {
      at: Date.now(),
      elapsed: Math.max(state.elapsed_seconds, shown.current.seconds),
    };
  }, [state?.elapsed_seconds, state?.status]);

  useEffect(() => {
    if (state?.status !== "active") return;
    const id = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, [state?.status]);

  // A clock must never run backwards. The local count can briefly sit
  // ahead of the server — the poll is three seconds behind, and the
  // meter starts somewhere in between — so the correction is applied by
  // holding the figure until the server catches up, not by jumping back
  // and confusing whoever is watching their money.
  const computed =
    state?.status === "active" && anchor.current
      ? anchor.current.elapsed +
        Math.max(0, Math.floor((Date.now() - anchor.current.at) / 1000))
      : state?.elapsed_seconds ?? 0;

  if (shown.current.session !== call.session_id) {
    shown.current = { session: call.session_id, seconds: 0 };
  }
  if (computed > shown.current.seconds) shown.current.seconds = computed;
  const elapsed = shown.current.seconds;

  const rate = state?.rate_per_minute ?? 0;

  /**
   * What the call has cost at this second, under the server's own rule:
   * whole minutes, rounded up, with the first ten seconds free. Between
   * polls this steps on the minute instead of waiting up to three
   * seconds, and every poll re-anchors it to the server's figure.
   */
  const chargedNow =
    elapsed <= 10 ? 0 : Math.min(Math.max(1, Math.ceil(elapsed / 60)) * rate, state?.hold_amount ?? Infinity);

  const serverMoney = viewer === "customer" ? state?.spent_so_far ?? 0 : state?.billed_amount ?? 0;
  const grossNow = state?.status === "active" ? Math.max(chargedNow, serverMoney) : serverMoney;

  // The customer watches what they pay; the model watches what she keeps,
  // which is the same minutes less the platform's share.
  const commission = state?.commission_rate ?? 0;
  const money =
    viewer === "customer"
      ? grossNow
      : grossNow - Math.round((grossNow * commission) / 100);

  const remaining =
    typeof state?.remaining_seconds === "number" && anchor.current && state.status === "active"
      ? Math.max(
          0,
          state.remaining_seconds -
            Math.max(0, Math.floor((Date.now() - anchor.current.at) / 1000)),
        )
      : state?.remaining_seconds;

  const lowOnFunds =
    viewer === "customer" && (remaining ?? Infinity) <= 60 && state?.status === "active";

  /** Video on screen changes the whole layout, not just one element. */
  const onVideo = media.remoteVideo;

  return (
    // A call takes the whole screen. The customer route is nested inside
    // the app shell, so on a desktop the sidebar sat beside the call and
    // the stage was squeezed into what was left. Fixed inset-0 lifts it
    // out of that column and over the navigation, which is also what
    // stops someone wandering off mid-call by accident.
    <div className="fixed inset-0 z-[60] flex flex-col bg-gray-900 text-white">
      {/* The other person's audio always plays. Their video, when they
          send it, fills the screen behind everything else — a call is
          about seeing them, so the picture gets the room and the
          numbers float on top of it. */}
      <audio ref={media.remoteAudioRef} autoPlay />
      <video
        ref={media.remoteVideoRef}
        autoPlay
        playsInline
        className={
          onVideo
            ? "absolute inset-0 h-full w-full bg-black object-cover"
            : "hidden"
        }
      />

      {/* Name, timer and money. Over video they sit at the top on a
          gradient dark enough to stay readable against a bright scene;
          on a voice call they take the middle of an empty screen. */}
      <div
        className={
          onVideo
            ? "pointer-events-none absolute inset-x-0 top-0 z-10 flex flex-col items-center gap-1 bg-gradient-to-b from-black/70 via-black/40 to-transparent px-6 pb-10 pt-[max(1rem,env(safe-area-inset-top))] text-center"
            : "flex flex-1 flex-col items-center justify-center gap-4 px-6"
        }
      >
        {!onVideo && (
          <>
            {peerPhoto ? (
              <img
                src={peerPhoto}
                alt={peerName}
                className="h-28 w-28 rounded-full object-cover ring-4 ring-white/10"
              />
            ) : (
              <div className="flex h-28 w-28 items-center justify-center rounded-full bg-white/10">
                <User className="h-12 w-12 text-white/60" />
              </div>
            )}
          </>
        )}

        <div className="text-center">
          <p className={onVideo ? "text-lg font-semibold drop-shadow" : "text-xl font-semibold"}>
            {peerName}
          </p>
          <p className={onVideo ? "text-sm text-white/80 drop-shadow" : "mt-1 text-sm text-white/60"}>
            {ringing
              ? t("call.ringing", { defaultValue: "Ringing…" })
              : formatDuration(elapsed)}
          </p>
        </div>

        {/* What it is costing, or earning. On video this is one quiet
            line rather than a panel, so it never covers a face. */}
        {state?.status === "active" && (
          onVideo ? (
            <p className="text-xs text-white/75 drop-shadow">
              {viewer === "customer"
                ? t("call.costSoFar", { defaultValue: "Cost so far" })
                : t("call.earningSoFar", { defaultValue: "Earning so far" })}
              {": "}
              <span className="font-semibold text-white">
                {Number(money ?? 0).toLocaleString()} ₭
              </span>
              {viewer === "customer" && typeof remaining === "number" && (
                <>
                  {" · "}
                  {t("call.timeLeft", {
                    defaultValue: "{{time}} left",
                    time: formatDuration(remaining),
                  })}
                </>
              )}
            </p>
          ) : (
            <div className="rounded-xl bg-white/5 px-4 py-2 text-center">
              <p className="text-[11px] uppercase tracking-wide text-white/40">
                {viewer === "customer"
                  ? t("call.costSoFar", { defaultValue: "Cost so far" })
                  : t("call.earningSoFar", { defaultValue: "Earning so far" })}
              </p>
              <p className="text-lg font-bold">
                {Number(money ?? 0).toLocaleString()} ₭
              </p>
              <p className="text-[11px] text-white/40">
                {state.rate_per_minute.toLocaleString()} ₭ /{" "}
                {t("call.minute", { defaultValue: "min" })}
              </p>

              {/* How much talking is left in the wallet. The server holds
                  the money up front and ends the call itself when it runs
                  out, so this is a countdown to a real event, not a hint. */}
              {viewer === "customer" && typeof remaining === "number" && (
                <p className="mt-1 text-[11px] text-white/50">
                  {t("call.timeLeft", {
                    defaultValue: "{{time}} left",
                    time: formatDuration(remaining),
                  })}
                </p>
              )}
            </div>
          )
        )}

        {lowOnFunds && (
          <p className="pointer-events-auto rounded-lg bg-amber-500/20 px-3 py-1.5 text-xs text-amber-200">
            {t("call.lowBalance", {
              defaultValue: "Less than a minute of balance left",
            })}
          </p>
        )}

        {media.error && (
          <p className="pointer-events-auto rounded-lg bg-red-500/20 px-3 py-1.5 text-xs text-red-200">
            {mediaErrorText(media.error, t)}
          </p>
        )}

        {/* The connection line is noise over a live picture. */}
        {!onVideo && (
          <p className="flex items-center gap-1 text-[11px] text-white/30">
            {media.state === "connected" ? (
              <Wifi className="h-3 w-3" />
            ) : (
              <WifiOff className="h-3 w-3" />
            )}
            {media.state === "reconnecting"
              ? t("call.reconnecting", { defaultValue: "Reconnecting…" })
              : media.state}
          </p>
        )}
      </div>

      {/* Our own camera, as a small picture-in-picture above the
          controls, wherever they are. */}
      {media.cameraEnabled && (
        <video
          ref={media.localVideoRef}
          autoPlay
          playsInline
          muted
          className="absolute right-4 z-10 h-36 w-28 rounded-xl bg-black object-cover shadow-lg ring-2 ring-white/20"
          style={{ bottom: "calc(7rem + env(safe-area-inset-bottom))" }}
        />
      )}

      {/* Controls */}
      <div
        className={
          onVideo
            ? "absolute inset-x-0 bottom-0 z-10 flex items-center justify-center gap-5 bg-gradient-to-t from-black/70 to-transparent px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-10"
            : "flex items-center justify-center gap-5 border-t border-white/10 px-6 py-6"
        }
      >
        <button
          onClick={media.toggleMic}
          aria-label="Microphone"
          className={`flex h-12 w-12 items-center justify-center rounded-full ${
            media.micEnabled ? "bg-white/10" : "bg-white/80 text-gray-900"
          }`}
        >
          {media.micEnabled ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}
        </button>

        {/* Always offered: a voice call can become a video call and go
            back again, the way the phone apps do. */}
        {(
          <button
            onClick={media.toggleCamera}
            aria-label="Camera"
            className={`flex h-12 w-12 items-center justify-center rounded-full ${
              media.cameraEnabled ? "bg-white/10" : "bg-white/80 text-gray-900"
            }`}
          >
            {media.cameraEnabled ? (
              <Video className="h-5 w-5" />
            ) : (
              <VideoOff className="h-5 w-5" />
            )}
          </button>
        )}

        <button
          onClick={hangUp}
          disabled={action.state !== "idle"}
          aria-label="Hang up"
          className="flex h-14 w-14 items-center justify-center rounded-full bg-rose-500 disabled:opacity-60"
        >
          <PhoneOff className="h-6 w-6" />
        </button>
      </div>
    </div>
  );
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/**
 * Why the microphone or the room would not start, in words that say what
 * to do about it.
 *
 * The hook reports a code rather than a sentence so this stays
 * translatable; an unknown code falls through to the generic line.
 */
function mediaErrorText(
  code: string,
  t: (key: string, options: Record<string, unknown>) => string,
): string {
  switch (code) {
    case "noDevice":
      return t("call.mediaNoDevice", {
        defaultValue:
          "No microphone found on this device. Connect one, or call from your phone.",
      });
    case "denied":
      return t("call.mediaDenied", {
        defaultValue:
          "Microphone access is needed for a call. Allow it in your browser settings and try again.",
      });
    case "deviceBusy":
      return t("call.mediaBusy", {
        defaultValue:
          "Your microphone is in use by another app. Close it and try again.",
      });
    case "insecure":
      return t("call.mediaInsecure", {
        defaultValue:
          "Calls need a secure (https) connection. Open the site over https and try again.",
      });
    default:
      return t("call.mediaConnect", {
        defaultValue: "Could not connect the call. Please try again.",
      });
  }
}
