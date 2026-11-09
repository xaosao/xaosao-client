/**
 * Daily check-in — website side.
 *
 * All the rules live in xs_backend: it owns the wallet, the once-a-day
 * guard, the weekday amounts and the cap, and it is the same code the
 * Flutter app calls. This file is only a typed wrapper, so the website
 * and the app can never drift into paying out under different rules.
 */

import { unwrapEnvelope, xsRequest, XsApiError } from "./xs-api.server";

export type CheckinDayStatus = "claimed" | "today" | "missed" | "upcoming";

export interface CheckinDay {
  /** 1 = Monday … 7 = Sunday. */
  weekday: number;
  /** The Lao calendar date this cell stands for, "YYYY-MM-DD". */
  date: string;
  amount: number;
  status: CheckinDayStatus;
  soldOut: boolean;
}

export interface CheckinState {
  days: CheckinDay[];
  streak: number;
  today_amount: number;
  can_claim: boolean;
  already_claimed: boolean;
  cap_reached: boolean;
  /** Display string from the API, "dd-MM-yyyy HH:mm:ss" Vientiane time. */
  next_at: string | null;
  /**
   * The same moment as epoch milliseconds. The API formats dates for
   * display, and that format cannot be parsed back, so the countdown
   * uses this number.
   */
  next_at_ms: number | null;
  message: string | null;
}

const EMPTY: CheckinState = {
  days: [],
  streak: 0,
  today_amount: 0,
  can_claim: false,
  already_claimed: false,
  cap_reached: false,
  next_at: null,
  next_at_ms: null,
  message: null,
};

/**
 * This week's strip, the streak and what today pays.
 *
 * Never throws: the card is a nice-to-have, and a backend hiccup must not
 * take down the page it sits on. An empty week simply renders nothing.
 */
export async function getCheckinState(modelId: string): Promise<CheckinState> {
  try {
    const response = await xsRequest("rewards/checkin", {
      userId: modelId,
      userType: "model",
    });
    return unwrapEnvelope<CheckinState>(response) ?? EMPTY;
  } catch (error) {
    console.error(
      "[checkin] could not read state:",
      error instanceof XsApiError ? error.message : error
    );
    return EMPTY;
  }
}

/**
 * Take today's check-in.
 *
 * Unlike the read above, failures here matter and are surfaced: the
 * backend re-checks the weekday, the cap and whether it was already
 * taken, and its message is what the model needs to see.
 */
export async function claimCheckin(
  modelId: string
): Promise<
  | { ok: true; amount: number; streak: number }
  | { ok: false; error: string }
> {
  try {
    const response = await xsRequest("rewards/checkin/claim", {
      userId: modelId,
      userType: "model",
      method: "POST",
    });
    const data = unwrapEnvelope<{ amount: number; streak: number }>(response);
    return { ok: true, amount: data?.amount ?? 0, streak: data?.streak ?? 1 };
  } catch (error) {
    const message =
      error instanceof XsApiError
        ? error.message
        : "Could not check in. Please try again.";
    console.error("[checkin] claim failed:", message);
    return { ok: false, error: message };
  }
}
