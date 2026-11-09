import { useEffect, useState } from "react";
import { useFetcher } from "react-router";
import { useTranslation } from "react-i18next";
import { Check, Flame, Gift, LoaderCircle } from "lucide-react";

import type { CheckinDay, CheckinState } from "~/services/checkin.server";

/**
 * Daily check-in.
 *
 * One tap a day pays the model whatever an admin set for that weekday,
 * and the strip shows the week so far: ticked days are taken, today is
 * live, past days without a tick are gone. The countdown is to the next
 * Lao midnight, which is when the next check-in opens.
 *
 * Every rule is enforced in xs_backend. Nothing here decides whether a
 * claim is allowed — it only draws what the server says.
 */
export function CheckinCard() {
  const { t } = useTranslation();
  const state = useFetcher<CheckinState>();
  const claim = useFetcher<
    { ok: true; amount: number; streak: number } | { ok: false; error: string }
  >();

  // Load once on mount, and again after a successful claim so the strip,
  // the streak and the countdown all come from one source of truth.
  useEffect(() => {
    if (state.state === "idle" && !state.data) state.load("/model/checkin");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (claim.data && "ok" in claim.data && claim.data.ok) {
      state.load("/model/checkin");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [claim.data]);

  // Midnight arrives while the page is open: refresh rather than leave
  // yesterday's "already checked in" on screen until someone reloads.
  const nextAt = state.data?.next_at_ms ?? null;
  useEffect(() => {
    if (!nextAt) return;
    const wait = nextAt - Date.now();
    if (wait <= 0) return;
    // A second of slack, so the server has crossed the day boundary too.
    const id = setTimeout(() => state.load("/model/checkin"), wait + 1000);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nextAt]);

  const data = state.data;
  const countdown = useCountdown(data?.next_at_ms ?? null);

  // Nothing configured, or the backend is unreachable: show nothing
  // rather than an empty promise of a reward.
  if (!data || data.days.length === 0) return null;

  const busy = claim.state !== "idle";
  const claimed = claim.data && "ok" in claim.data && claim.data.ok;

  return (
    <div className="mb-4 overflow-hidden rounded-xl border border-gray-100 bg-white">
      <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
        <p className="text-sm font-bold text-gray-900">{t("checkin.title")}</p>
        <span className="flex items-center gap-1 text-sm font-semibold text-amber-500">
          <Flame className="h-4 w-4" />
          {t("checkin.streak", { count: data.streak })}
        </span>
      </div>

      <div className="grid grid-cols-2 divide-x divide-gray-100 border-b border-gray-100">
        <div className="px-4 py-3 text-center">
          <p className="text-[11px] text-gray-500">{t("checkin.nextIn")}</p>
          <p className="text-xl font-bold tabular-nums text-amber-500">
            {countdown ?? "--:--:--"}
          </p>
          <p className="mt-0.5 text-[11px] text-gray-400">
            {t("checkin.nextHint")}
          </p>
        </div>
        <div className="px-4 py-3 text-center">
          <p className="text-[11px] text-gray-500">{t("checkin.todayPays")}</p>
          <p className="text-xl font-bold text-gray-900">
            {data.today_amount.toLocaleString()}
            <span className="ml-1 text-xs font-normal text-gray-500">₭</span>
          </p>
          <p className="mt-0.5 text-[11px] text-gray-400">
            {t("checkin.todayHint")}
          </p>
        </div>
      </div>

      <div className="flex items-start justify-between gap-1 px-3 py-3">
        {data.days.map((day) => (
          <DayCell key={day.weekday} day={day} />
        ))}
      </div>

      <div className="px-4 pb-4">
        {data.can_claim ? (
          <claim.Form method="post" action="/model/checkin">
            <button
              type="submit"
              disabled={busy}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-rose-500 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
            >
              {busy ? (
                <LoaderCircle className="h-4 w-4 animate-spin" />
              ) : (
                <Gift className="h-4 w-4" />
              )}
              {t("checkin.claim", {
                amount: data.today_amount.toLocaleString(),
              })}
            </button>
          </claim.Form>
        ) : (
          <p className="rounded-lg bg-gray-50 py-2.5 text-center text-xs text-gray-500">
            {data.already_claimed
              ? t("checkin.doneToday")
              : data.cap_reached
              ? t("checkin.finished")
              : t("checkin.closedToday")}
          </p>
        )}

        {claimed && (
          <p className="mt-2 text-center text-xs font-medium text-emerald-600">
            {t("checkin.claimed", {
              amount: (claim.data as { amount: number }).amount.toLocaleString(),
            })}
          </p>
        )}
        {claim.data && "ok" in claim.data && !claim.data.ok && (
          <p className="mt-2 text-center text-xs text-red-600">
            {claim.data.error}
          </p>
        )}
      </div>
    </div>
  );
}

/** One day of the week: ticked, live, missed or still to come. */
function DayCell({ day }: { day: CheckinDay }) {
  const { t } = useTranslation();
  const label = t(`checkin.weekday.${day.weekday}`);

  const ring =
    day.status === "claimed"
      ? "bg-amber-400 text-white"
      : day.status === "today"
      ? "border-2 border-amber-400 bg-white text-amber-500"
      : day.status === "missed"
      ? "bg-gray-100 text-gray-300"
      : "bg-gray-100 text-gray-400";

  return (
    <div className="flex flex-1 flex-col items-center gap-1">
      <div
        className={`flex h-9 w-9 items-center justify-center rounded-full ${ring}`}
      >
        {day.status === "claimed" ? (
          <Check className="h-4 w-4" />
        ) : (
          <Gift className="h-4 w-4" />
        )}
      </div>
      <span
        className={`text-[10px] ${
          day.status === "today" ? "font-semibold text-amber-500" : "text-gray-500"
        }`}
      >
        {label}
      </span>
      {day.amount > 0 && (
        <span className="text-[9px] text-gray-400">
          {day.amount.toLocaleString()}
        </span>
      )}
    </div>
  );
}

/**
 * Time left until `target` (epoch ms), as HH:MM:SS.
 *
 * The deadline is the server's; only the ticking is local, so a phone
 * with a wrong clock shows a wrong countdown but still cannot claim
 * early — the backend decides that.
 */
function useCountdown(target: number | null): string | null {
  const [label, setLabel] = useState<string | null>(null);

  useEffect(() => {
    if (!target || !Number.isFinite(target)) {
      setLabel(null);
      return;
    }

    const tick = () => {
      const left = Math.max(0, target - Date.now());
      const h = Math.floor(left / 3_600_000);
      const m = Math.floor((left % 3_600_000) / 60_000);
      const s = Math.floor((left % 60_000) / 1000);
      setLabel(
        [h, m, s].map((n) => String(n).padStart(2, "0")).join(":")
      );
    };

    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [target]);

  return label;
}
