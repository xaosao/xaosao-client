/**
 * "Call her" — the confirmation before a per-minute call starts.
 *
 * Deliberately short: the price, what the wallet covers, and one button.
 * Everything it reports comes from xs_backend, which also decides
 * whether the call may start at all, so this screen cannot promise a
 * call it is not allowed to place.
 *
 * Scheduled calls are gone with the old flow — a per-minute call is an
 * immediate thing, and nothing was ever booked for later.
 */

import { useEffect } from "react";
import {
  useFetcher,
  useLoaderData,
  useNavigate,
  useParams,
  useRevalidator,
  type LoaderFunctionArgs,
} from "react-router";
import { useTranslation } from "react-i18next";
import {
  BellRing,
  Check,
  Loader,
  MoonStar,
  Phone,
  Users,
  Video,
  Wallet,
  X,
} from "lucide-react";

import Modal from "~/components/ui/model";
import { Button } from "~/components/ui/button";
import { requireUserSession } from "~/services/auths.server";
import {
  getCallRate,
  type CallNoticeResult,
  type StartedCall,
} from "~/services/call.server";
import { prisma } from "~/services/database.server";

export async function loader({ params, request }: LoaderFunctionArgs) {
  const customerId = await requireUserSession(request);
  const modelId = params.modelId as string;

  const [rate, wallet, model] = await Promise.all([
    getCallRate({ userId: customerId as string, userType: "customer" }, modelId),
    prisma.wallet
      .findFirst({
        where: { customerId, status: "active" },
        select: { totalBalance: true, totalSpend: true, totalRefunded: true },
      })
      .catch(() => null),
    prisma.model.findUnique({
      where: { id: modelId },
      select: { firstName: true, lastName: true, profile: true },
    }),
  ]);

  // The spendable figure, the same arithmetic the wallet screen uses.
  const available =
    (wallet?.totalBalance ?? 0) -
    (wallet?.totalSpend ?? 0) +
    (wallet?.totalRefunded ?? 0);

  return { rate, available, model };
}

export default function CallModel() {
  const { rate, available, model } = useLoaderData<typeof loader>();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const params = useParams();
  const revalidator = useRevalidator();
  const start = useFetcher<
    { ok: true; call: StartedCall } | { ok: false; error: string }
  >();
  // Its own fetcher: asking her to come online is not placing a call,
  // and sharing `start`'s state would make the Voice button spin.
  const notify = useFetcher<
    { ok: true; notice: CallNoticeResult } | { ok: false; error: string }
  >();

  const name =
    `${model?.firstName ?? ""} ${model?.lastName ?? ""}`.trim() || "Model";
  const perMinute = rate.rate_per_minute ?? 0;
  const minutes = perMinute > 0 ? Math.floor(available / perMinute) : 0;
  const affordable = minutes >= 2;

  useEffect(() => {
    const data = start.data as any;
    if (data?.ok && data.call?.session_id) {
      navigate(`/customer/call/active/${data.call.session_id}`, {
        replace: true,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [start.data]);

  function place(callType: "audio" | "video") {
    const form = new FormData();
    form.set("intent", "start");
    form.set("modelId", params.modelId as string);
    form.set("callType", callType);
    start.submit(form, { method: "post", action: "/api/call/session" });
  }

  function letHerKnow() {
    const form = new FormData();
    form.set("intent", "notify");
    form.set("modelId", params.modelId as string);
    notify.submit(form, { method: "post", action: "/api/call/session" });
  }

  const notifying = notify.state !== "idle";
  const noticeData = notify.data as any;
  /** Sent just now, or sent minutes ago — either way she has been told. */
  const noticeDone =
    noticeData?.ok === true &&
    (noticeData.notice?.sent === true || noticeData.notice?.throttled === true);
  /**
   * She opened the app between this screen loading and the tap. Reload
   * so the call buttons appear instead of leaving a dead end.
   */
  const noticeFoundHerOnline =
    noticeData?.ok === true && noticeData.notice?.already_online === true;
  const noticeError =
    noticeData?.ok === false ? String(noticeData.error) : null;

  useEffect(() => {
    if (noticeFoundHerOnline) revalidator.revalidate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [noticeFoundHerOnline]);

  const busy = start.state !== "idle";
  const rawError = (start.data as any)?.ok === false ? (start.data as any).error : null;

  /**
   * The server answers in English. Show it in the customer's language.
   *
   * These are the only refusals `POST /calls` produces, and each one has
   * something the customer can actually do about it, so they are worth
   * wording properly rather than passing the raw sentence through — a
   * bare "You are already on a call" in an otherwise Lao screen reads
   * like a crash.
   */
  const error = (() => {
    if (!rawError) return null;
    const m = String(rawError);
    if (m.includes("already on a call")) {
      return t("call.errorAlreadyOnCall", {
        defaultValue:
          "Your last call is still open. It ends on its own in under a minute — then try again.",
      });
    }
    if (m.includes("on another call")) {
      return t("call.errorPeerBusy", { defaultValue: "This person is on another call." });
    }
    if (m.includes("does not take calls")) {
      return t("call.notAvailable", { defaultValue: "This person does not take calls right now." });
    }
    // `reachable` was true when this screen loaded and false by the time
    // the button was pressed — she closed the app in between. Common
    // enough to deserve its own wording rather than a generic failure.
    if (m.includes("not online right now")) {
      return t("call.wentOffline", {
        defaultValue:
          "She just went offline. We've let her know you want to call — try again shortly, or find someone who is online now.",
      });
    }
    if (m.includes("not available")) {
      return t("call.errorPeerUnavailable", { defaultValue: "This person is not available." });
    }
    if (m.includes("Calling is not available")) {
      return t("call.errorServiceDown", { defaultValue: "Calling is unavailable right now. Please try later." });
    }
    if (m.includes("You need at least")) {
      return t("call.needTwoMinutes", {
        defaultValue: "You need at least {{amount}} ₭ to start a call",
        amount: (perMinute * 2).toLocaleString(),
      });
    }
    return m;
  })();

  return (
    <Modal onClose={() => navigate(-1)} className="w-full max-w-sm">
      <div className="space-y-4 p-1">
        <div className="flex items-start justify-between">
          <h2 className="text-base font-bold text-gray-900">
            {t("call.callName", { defaultValue: "Call {{name}}", name })}
          </h2>
          <button onClick={() => navigate(-1)} aria-label="Close">
            <X className="h-5 w-5 text-gray-400" />
          </button>
        </div>

        {!rate.callable ? (
          <p className="rounded-lg bg-gray-50 px-3 py-4 text-center text-sm text-gray-600">
            {t("call.notAvailable", {
              defaultValue: "This person does not take calls right now.",
            })}
          </p>
        ) : !rate.reachable ? (
          /*
           * She sells calls but is not in the app, so nothing can ring
           * her. Say so before any money is held rather than taking the
           * hold, ringing an empty room for 45 seconds and refunding.
           *
           * No "call anyway" button on purpose: it is the exact failure
           * this screen exists to prevent.
           */
          <div className="space-y-3">
            <div className="rounded-xl bg-gray-50 px-4 py-5 text-center">
              <MoonStar className="mx-auto mb-2 h-7 w-7 text-gray-400" />
              <p className="text-sm font-semibold text-gray-900">
                {t("call.offlineTitle", {
                  defaultValue: "{{name}} is offline",
                  name,
                })}
              </p>
              <p className="mt-1 text-xs leading-relaxed text-gray-500">
                {noticeDone
                  ? t("call.offlineNotified", {
                      defaultValue:
                        "{{name}} has been told you want to call. She will see it when she next opens the app — nothing has been charged.",
                      name,
                    })
                  : t("call.offlineBody", {
                      defaultValue:
                        "She can only be reached while the app is open. You can let her know you want to call — nothing is charged either way.",
                    })}
              </p>
            </div>

            {noticeError && (
              <p className="text-center text-xs text-red-600">{noticeError}</p>
            )}

            {/*
             * The point of this screen. Without a button, the customer
             * has no way to reach a model who is not in the app, and
             * telling them she "has been notified" when nothing was sent
             * is worse than saying nothing.
             */}
            {noticeDone ? (
              <div className="flex w-full items-center justify-center gap-2 rounded-md bg-emerald-50 px-3 py-2.5 text-sm font-medium text-emerald-700">
                <Check className="h-4 w-4" />
                {t("call.noticeSent", { defaultValue: "She has been notified" })}
              </div>
            ) : (
              <Button
                onClick={letHerKnow}
                disabled={notifying}
                className="w-full bg-rose-500 text-white hover:bg-rose-600"
              >
                {notifying ? (
                  <Loader className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <BellRing className="mr-2 h-4 w-4" />
                )}
                {t("call.notifyHer", {
                  defaultValue: "Let her know you want to call",
                })}
              </Button>
            )}

            <Button
              onClick={() => navigate("/customer")}
              variant="outline"
              className="w-full"
            >
              <Users className="mr-2 h-4 w-4" />
              {t("call.findOnline", { defaultValue: "Find someone online" })}
            </Button>
          </div>
        ) : (
          <>
            <div className="rounded-xl bg-rose-50 px-4 py-3 text-center">
              <p className="text-2xl font-bold text-rose-600">
                {perMinute.toLocaleString()} ₭
              </p>
              <p className="text-xs text-rose-500/80">
                {t("call.perMinute", { defaultValue: "per minute" })}
              </p>
            </div>

            <div className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2 text-sm">
              <span className="flex items-center gap-2 text-gray-500">
                <Wallet className="h-4 w-4" />
                {t("call.yourBalance", { defaultValue: "Your balance" })}
              </span>
              <span className="font-semibold text-gray-900">
                {available.toLocaleString()} ₭
              </span>
            </div>

            <p className="text-center text-xs text-gray-500">
              {affordable
                ? t("call.coversMinutes", {
                    defaultValue: "Enough for about {{minutes}} minutes",
                    minutes,
                  })
                : t("call.needTwoMinutes", {
                    defaultValue:
                      "You need at least {{amount}} ₭ to start a call",
                    amount: (perMinute * 2).toLocaleString(),
                  })}
            </p>

            {error && <p className="text-center text-xs text-red-600">{error}</p>}

            {affordable ? (
              <div className="flex gap-2">
                <Button
                  onClick={() => place("audio")}
                  disabled={busy}
                  className="flex-1 bg-rose-500 text-white hover:bg-rose-600"
                >
                  {busy ? (
                    <Loader className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Phone className="mr-2 h-4 w-4" />
                  )}
                  {t("call.voice", { defaultValue: "Voice" })}
                </Button>
                <Button
                  onClick={() => place("video")}
                  disabled={busy}
                  variant="outline"
                  className="flex-1"
                >
                  <Video className="mr-2 h-4 w-4" />
                  {t("call.video", { defaultValue: "Video" })}
                </Button>
              </div>
            ) : (
              <Button
                onClick={() =>
                  navigate(
                    `/customer/wallet-topup?amount=${Math.max(0, perMinute * 10 - available)}`
                  )
                }
                className="w-full bg-rose-500 text-white hover:bg-rose-600"
              >
                <Wallet className="mr-2 h-4 w-4" />
                {t("call.topUp", { defaultValue: "Add money" })}
              </Button>
            )}

            <p className="text-center text-[11px] text-gray-400">
              {t("call.billingNote", {
                defaultValue:
                  "Charged by the minute, rounded up. The first 10 seconds are free, and anything unused goes back to your wallet.",
              })}
            </p>
          </>
        )}
      </div>
    </Modal>
  );
}
