/**
 * What a model may charge, per billing type.
 *
 * Every other price on the platform is a whole session — a day, a night,
 * an hour — so a 10,000 kip floor is the right shape for them: it stops a
 * model typing "500" when they meant "500,000".
 *
 * A per-minute call rate is not that kind of price. A 30-minute call at
 * 10,000/min already costs 300,000 kip, so the session floor read as a
 * ceiling in disguise: it rejected 3,000/min, which is what a call is
 * actually worth, and made the call service impossible to apply for.
 *
 * So per-minute gets its own range. The ceiling matters more than the
 * floor here, because the customer's wallet is held for up to 60 minutes
 * up front: at 10,000/min that hold is already 600,000 kip.
 *
 * These are shared by the apply form, the edit form, the sign-up flow and
 * the server, so the four cannot drift apart — a client-side rule alone
 * is a suggestion, not a limit.
 */

/** Floor for session-priced services: per day, per hour, per session. */
export const MIN_PRICE = 10_000;

/** A call may be cheap, but not free. */
export const MIN_MINUTE_RATE = 1_000;

/** A call may not be dearer than this, whatever the model asks. */
export const MAX_MINUTE_RATE = 10_000;

export interface PriceBounds {
  min: number;
  /** Null where there is no upper limit. */
  max: number | null;
}

/**
 * The range allowed for one billing type.
 *
 * `per_minute` is the only one with a ceiling; the rest keep the session
 * floor and no maximum.
 */
export function priceBoundsFor(billingType: string | null | undefined): PriceBounds {
  if (billingType === "per_minute") {
    return { min: MIN_MINUTE_RATE, max: MAX_MINUTE_RATE };
  }
  return { min: MIN_PRICE, max: null };
}

/**
 * Is this amount allowed for this billing type?
 *
 * Takes the raw string straight from an input — "3,000", " 3000 ", "" —
 * so callers do not each reinvent the parsing and disagree about what
 * an empty field means. Empty, non-numeric and out of range are all false.
 */
export function isRateValid(
  billingType: string | null | undefined,
  value: string | number | null | undefined
): boolean {
  const amount = toAmount(value);
  if (amount === null) return false;

  const { min, max } = priceBoundsFor(billingType);
  if (amount < min) return false;
  if (max !== null && amount > max) return false;
  return true;
}

/**
 * A rate as a number, or null when there is nothing usable there.
 *
 * Strips the thousands separators the price inputs add as you type.
 */
export function toAmount(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  const cleaned = value.replace(/,/g, "").trim();
  if (cleaned === "") return null;

  const amount = Number(cleaned);
  return Number.isFinite(amount) ? amount : null;
}

/**
 * Why an amount was rejected, as an i18n key plus the numbers to
 * interpolate — so the message names the actual limit instead of a
 * hardcoded "10,000" that stopped being true.
 *
 * Returns null when the amount is fine.
 */
export function rateError(
  billingType: string | null | undefined,
  value: string | number | null | undefined
): { key: string; values: Record<string, string> } | null {
  if (isRateValid(billingType, value)) return null;

  const { min, max } = priceBoundsFor(billingType);
  const fmt = (n: number) => n.toLocaleString("en-US");

  if (max !== null) {
    return {
      key: "modelServices.minuteRateRange",
      values: { min: fmt(min), max: fmt(max) },
    };
  }
  return { key: "modelServices.minimumPrice", values: { min: fmt(min) } };
}
