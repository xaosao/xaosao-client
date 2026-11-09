import { useEffect, useMemo, useState } from "react";
import { useFetcher } from "react-router";
import { Gift, X } from "lucide-react";

import type { RewardState } from "~/services/reward.server";

/**
 * The daily reward popup.
 *
 * Appears when a reward slot is open, counts down to the server's expiry
 * and disappears when it runs out. The countdown is display only — the
 * backend re-checks the window on claim, so a stale screen cannot pay out.
 *
 * Polls while mounted so a model already sitting in the app sees the
 * reward appear at the configured time without reloading.
 */
export function RewardPopup() {
  const state = useFetcher<RewardState>();
  const claim = useFetcher<{ ok: boolean; amount?: number; error?: string }>();
  const [dismissed, setDismissed] = useState(false);
  const [claimed, setClaimed] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());

  // First read on mount, then every minute. A slot opens on a clock time,
  // so minute resolution is enough and keeps the traffic trivial.
  useEffect(() => {
    if (state.state === "idle" && !state.data) state.load("/model/reward");
    const id = setInterval(() => state.load("/model/reward"), 60_000);
    return () => clearInterval(id);
  }, [state]);

  // Drives the countdown.
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (claim.data?.ok) setClaimed(claim.data.amount ?? 0);
  }, [claim.data]);

  const reward = state.data?.reward ?? null;
  const slotId = reward?.slotId;

  const secondsLeft = useMemo(() => {
    if (!reward) return 0;
    return Math.max(0, Math.floor((reward.expires_at_ms - now) / 1000));
  }, [reward, now]);

  // A new slot resets the dismissal, so closing the 12:00 popup doesn't
  // also hide the 19:00 one.
  useEffect(() => {
    setDismissed(false);
    setClaimed(null);
  }, [slotId]);

  if (!reward || dismissed) return null;
  if (secondsLeft <= 0 && claimed === null) return null;

  const mm = String(Math.floor(secondsLeft / 60)).padStart(2, "0");
  const ss = String(secondsLeft % 60).padStart(2, "0");
  const isClaiming = claim.state !== "idle";

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/60 px-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-5 text-center shadow-2xl">
        <button
          onClick={() => setDismissed(true)}
          className="ml-auto block rounded-full p-1 hover:bg-gray-100"
          aria-label="Close"
        >
          <X className="h-4 w-4 text-gray-400" />
        </button>

        {claimed !== null ? (
          <>
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100">
              <Gift className="h-8 w-8 text-emerald-600" />
            </div>
            <h2 className="mt-3 text-lg font-bold text-gray-900">
              {claimed.toLocaleString()} LAK added
            </h2>
            <p className="mt-1 text-sm text-gray-600">
              It is in your wallet now.
            </p>
            <button
              onClick={() => setDismissed(true)}
              className="mt-4 w-full rounded-xl bg-gray-100 px-4 py-3 text-sm font-semibold text-gray-700"
            >
              Close
            </button>
          </>
        ) : (
          <>
            {reward.image ? (
              <img
                src={reward.image}
                alt={reward.name}
                className="mx-auto h-28 w-28 rounded-2xl object-cover"
              />
            ) : (
              <div className="mx-auto flex h-28 w-28 items-center justify-center rounded-2xl bg-rose-50">
                <Gift className="h-12 w-12 text-rose-400" />
              </div>
            )}

            <h2 className="mt-3 text-lg font-bold text-gray-900">
              {reward.name}
            </h2>
            <p className="text-2xl font-extrabold text-rose-500">
              {reward.amount.toLocaleString()} LAK
            </p>

            <p className="mt-2 text-sm text-gray-500">
              Expires in{" "}
              <span className="font-semibold tabular-nums text-gray-900">
                {mm}:{ss}
              </span>
            </p>
            {reward.remaining !== null && (
              <p className="text-xs text-amber-600">
                {reward.remaining} left today
              </p>
            )}

            {claim.data && !claim.data.ok && (
              <p className="mt-2 text-sm text-red-600">{claim.data.error}</p>
            )}

            <claim.Form method="post" action="/model/reward">
              <input type="hidden" name="slotId" value={reward.slotId} />
              <button
                type="submit"
                disabled={isClaiming || secondsLeft <= 0}
                className="mt-4 w-full rounded-xl bg-rose-500 px-4 py-3 text-sm font-bold text-white hover:bg-rose-600 disabled:opacity-60"
              >
                {isClaiming ? "Claiming..." : "Claim now"}
              </button>
            </claim.Form>
          </>
        )}
      </div>
    </div>
  );
}
