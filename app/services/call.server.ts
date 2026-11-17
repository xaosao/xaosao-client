/**
 * Per-minute calling — website side.
 *
 * Every rule that decides money lives in xs_backend: the rate, the hold,
 * the meter, the settlement and the right to end a call. This file is a
 * typed wrapper so the website and the Flutter app behave identically,
 * and so a browser can never be the thing that says how long a call ran.
 */

import { unwrapEnvelope, xsRequest, XsApiError } from "./xs-api.server";

export interface CallRate {
  /** Does she sell calls at all — an active per-minute service, rate > 0. */
  callable: boolean;
  /**
   * Can a ring land on her right now? True only while she holds an open
   * socket. Perishable by nature: accurate when the response was built
   * and nothing longer, so re-read it rather than caching it.
   */
  reachable: boolean;
  rate_per_minute: number | null;
  model_service_id: string | null;
}

export interface StartedCall {
  session_id: string;
  room_name: string;
  server_url: string;
  token: string;
  rate_per_minute: number;
  max_minutes: number;
  hold_amount: number;
}

export interface AnsweredCall {
  session_id: string;
  server_url: string;
  token: string;
  room_name: string;
  call_type: "audio" | "video";
  rate_per_minute: number;
}

export interface CallToken {
  session_id: string;
  server_url: string;
  token: string;
  room_name: string;
  call_type: "audio" | "video";
  status: "ringing" | "connecting" | "active";
  rate_per_minute: number;
  max_minutes: number;
}

export interface CallState {
  session_id: string;
  status: "ringing" | "connecting" | "active" | "ended";
  reason: string | null;
  call_type: "audio" | "video";
  rate_per_minute: number;
  /** Platform share, so the model's screen can show her own earning. */
  commission_rate: number;
  /** The ceiling the hold bought; the live cost never exceeds it. */
  hold_amount: number;
  max_minutes: number;
  elapsed_seconds: number;
  remaining_seconds: number;
  spent_so_far: number;
  billed_minutes: number;
  billed_amount: number;
  refunded: number;
}

export interface CallSummary {
  session_id: string;
  status: string;
  reason: string | null;
  billed_minutes: number;
  billed_amount: number;
  model_earning: number;
  refunded: number;
}

export interface CallHistoryRow {
  session_id: string;
  call_type: string;
  status: string;
  reason: string | null;
  rate_per_minute: number;
  billed_minutes: number;
  billed_amount: number;
  model_earning?: number;
  refunded?: number;
  started_at: string | null;
  ended_at: string | null;
  created_at: string;
}

type Who = { userId: string; userType: "customer" | "model" };

/** What this model charges, and whether calling is possible at all. */
export async function getCallRate(
  who: Who,
  modelId: string
): Promise<CallRate> {
  try {
    const response = await xsRequest(`calls/rate/${modelId}`, who);
    return (
      unwrapEnvelope<CallRate>(response) ?? {
        callable: false,
        reachable: false,
        rate_per_minute: null,
        model_service_id: null,
      }
    );
  } catch (error) {
    console.error("[call] rate lookup failed:", message(error));
    return {
      callable: false,
      reachable: false,
      rate_per_minute: null,
      model_service_id: null,
    };
  }
}

/** What came of asking an offline model to come online. */
export interface CallNoticeResult {
  sent: boolean;
  throttled: boolean;
  retry_in_seconds: number | null;
  already_online: boolean;
}

/**
 * "Let her know I want to call."
 *
 * Sends the model a push and nothing else — no room, no hold, no money.
 * Separate from `startCall` because there is no call: she is not in the
 * app, so there is nothing to ring.
 */
export async function requestCallNotice(
  who: Who,
  modelId: string
): Promise<
  { ok: true; notice: CallNoticeResult } | { ok: false; error: string }
> {
  try {
    const response = await xsRequest(`calls/notify/${modelId}`, {
      ...who,
      method: "POST",
    });
    const notice = unwrapEnvelope<CallNoticeResult>(response);
    if (!notice) return { ok: false, error: "Could not send the notification." };
    return { ok: true, notice };
  } catch (error) {
    return { ok: false, error: message(error) };
  }
}

/**
 * Place a call.
 *
 * Failures here matter and are passed through: "you need at least X to
 * start a call" is the answer, not an error to swallow.
 */
export async function startCall(
  who: Who,
  modelId: string,
  callType: "audio" | "video"
): Promise<{ ok: true; call: StartedCall } | { ok: false; error: string }> {
  try {
    const response = await xsRequest("calls", {
      ...who,
      method: "POST",
      body: { model_id: modelId, call_type: callType },
    });
    const call = unwrapEnvelope<StartedCall>(response);
    if (!call?.session_id) return { ok: false, error: "Could not start the call." };
    return { ok: true, call };
  } catch (error) {
    return { ok: false, error: message(error) };
  }
}

/** The model picks up and gets their own token for the same room. */
export async function answerCall(
  who: Who,
  sessionId: string
): Promise<{ ok: true; call: AnsweredCall } | { ok: false; error: string }> {
  try {
    const response = await xsRequest(`calls/${sessionId}/answer`, {
      ...who,
      method: "POST",
    });
    const call = unwrapEnvelope<AnsweredCall>(response);
    if (!call?.token) return { ok: false, error: "Could not answer the call." };
    return { ok: true, call };
  } catch (error) {
    return { ok: false, error: message(error) };
  }
}

export async function declineCall(
  who: Who,
  sessionId: string
): Promise<{ ok: boolean; error?: string }> {
  try {
    await xsRequest(`calls/${sessionId}/decline`, { ...who, method: "POST" });
    return { ok: true };
  } catch (error) {
    return { ok: false, error: message(error) };
  }
}

/**
 * Hang up.
 *
 * Settlement happens inside this call, so what comes back is final: what
 * the call cost, what the model earned, what went back to the wallet.
 */
export async function hangUpCall(
  who: Who,
  sessionId: string
): Promise<{ ok: true; summary: CallSummary } | { ok: false; error: string }> {
  try {
    const response = await xsRequest(`calls/${sessionId}/hangup`, {
      ...who,
      method: "POST",
    });
    const summary = unwrapEnvelope<CallSummary>(response);
    if (!summary) return { ok: false, error: "Could not end the call." };
    return { ok: true, summary };
  } catch (error) {
    return { ok: false, error: message(error) };
  }
}

/**
 * A media token for a call that is still running.
 *
 * Asked for on every load of a call screen, so a refresh mid-call
 * reconnects instead of dropping the caller.
 */
export async function getCallToken(
  who: Who,
  sessionId: string
): Promise<{ ok: true; call: CallToken } | { ok: false; error: string }> {
  try {
    const response = await xsRequest(`calls/${sessionId}/token`, who);
    const call = unwrapEnvelope<CallToken>(response);
    if (!call?.token) return { ok: false, error: "This call is no longer available." };
    return { ok: true, call };
  } catch (error) {
    return { ok: false, error: message(error) };
  }
}

/**
 * The live state of a call.
 *
 * The screens poll this: it is the server's view of the meter, so the
 * number on screen is the number that will be charged.
 */
export async function getCallState(
  who: Who,
  sessionId: string
): Promise<CallState | null> {
  try {
    const response = await xsRequest(`calls/${sessionId}`, who);
    return unwrapEnvelope<CallState>(response) ?? null;
  } catch (error) {
    console.error("[call] state read failed:", message(error));
    return null;
  }
}

export async function getCallHistory(
  who: Who,
  limit = 30
): Promise<CallHistoryRow[]> {
  try {
    const response = await xsRequest(`calls?limit=${limit}`, who);
    return unwrapEnvelope<{ calls: CallHistoryRow[] }>(response)?.calls ?? [];
  } catch (error) {
    console.error("[call] history failed:", message(error));
    return [];
  }
}

function message(error: unknown): string {
  return error instanceof XsApiError
    ? error.message
    : "Calling is unavailable right now. Please try again.";
}
