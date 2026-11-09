/**
 * Where is this request coming from?
 *
 * Used by the top-up flow to decide which payment experience to show:
 * customers in Laos keep the kip-and-bank-QR flow they already know,
 * while customers abroad get to choose a method and can pay in crypto.
 */

import { getLocationDetails } from "./base.server";

/** The one country that keeps the original flow. */
export const HOME_COUNTRY = "LA";

/**
 * Two-letter country code for the caller, or "LA" when it cannot be
 * determined.
 *
 * Falling back to Laos is deliberate. A failed lookup, a VPN or a local
 * request would otherwise push the majority of customers down the
 * unfamiliar path, and the kip flow is the safe default for a business
 * whose customers are overwhelmingly Lao. The cost is that a genuine
 * foreign customer behind a broken lookup sees the bank flow — which
 * still works, it just isn't their preferred method.
 */
export async function getCountryCode(request: Request): Promise<string> {
  const forwardedFor = request.headers.get("x-forwarded-for");
  const ip =
    forwardedFor?.split(",")[0].trim() ||
    request.headers.get("x-real-ip") ||
    "";

  // No usable address (local dev, direct hit) — don't waste a lookup.
  if (!ip || ip === "127.0.0.1" || ip === "::1") return HOME_COUNTRY;

  const accessKey = process.env.APIIP_API_KEY || "";
  if (!accessKey) return HOME_COUNTRY;

  try {
    const details = await getLocationDetails(ip, accessKey);
    const code = String(details?.countryCode || "").toUpperCase();
    return code.length === 2 ? code : HOME_COUNTRY;
  } catch {
    // getLocationDetails already falls back internally, but a thrown
    // error must not take down the page that asked.
    return HOME_COUNTRY;
  }
}

export async function isHomeCountry(request: Request): Promise<boolean> {
  return (await getCountryCode(request)) === HOME_COUNTRY;
}
