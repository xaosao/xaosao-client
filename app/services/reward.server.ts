/**
 * Daily rewards — website side.
 *
 * All the logic lives in xs_backend: it owns the wallet, the window check
 * and the daily cap, and it is the same code the Flutter app calls. This
 * file is only a typed wrapper so the website and the app can never drift
 * into paying out under different rules.
 */

import { unwrapEnvelope, xsRequest, XsApiError } from "./xs-api.server";

export interface AvailableReward {
  slotId: string;
  name: string;
  image: string | null;
  amount: number;
  /** Display string from the API, "dd-MM-yyyy HH:mm:ss" Vientiane time. */
  expiresAt: string;
  /**
   * The same moment as epoch milliseconds. The API formats dates for
   * display and that format cannot be parsed back, so the countdown
   * reads this number.
   */
  expires_at_ms: number;
  remaining: number | null;
}

export interface RewardState {
  reward: AvailableReward | null;
  already_claimed: boolean;
  cap_reached: boolean;
  message: string | null;
}

const EMPTY: RewardState = {
  reward: null,
  already_claimed: false,
  cap_reached: false,
  message: null,
};

/**
 * What, if anything, this model can claim right now.
 *
 * Never throws: a reward popup is a nice-to-have, and a backend hiccup
 * must not take down the page it is mounted on.
 */
export async function getRewardState(modelId: string): Promise<RewardState> {
  try {
    const response = await xsRequest("rewards/current", {
      userId: modelId,
      userType: "model",
    });
    return unwrapEnvelope<RewardState>(response) ?? EMPTY;
  } catch (error) {
    console.error(
      "[reward] could not read reward state:",
      error instanceof XsApiError ? error.message : error
    );
    return EMPTY;
  }
}

/**
 * Claim the open reward.
 *
 * Unlike the read above, failures here matter and are surfaced: the
 * backend re-checks the window, the cap and whether it was already taken,
 * and its message is what the model needs to see.
 */
export async function claimReward(
  modelId: string,
  slotId: string
): Promise<{ ok: true; amount: number } | { ok: false; error: string }> {
  try {
    const response = await xsRequest(`rewards/${slotId}/claim`, {
      userId: modelId,
      userType: "model",
      method: "POST",
    });
    const data = unwrapEnvelope<{ amount: number }>(response);
    return { ok: true, amount: data?.amount ?? 0 };
  } catch (error) {
    const message =
      error instanceof XsApiError
        ? error.message
        : "Could not claim this reward. Please try again.";
    console.error("[reward] claim failed:", message);
    return { ok: false, error: message };
  }
}
