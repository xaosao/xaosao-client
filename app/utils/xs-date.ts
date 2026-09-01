/**
 * Date parsing for xs_backend responses.
 *
 * xs_backend runs a global `DateSerializationInterceptor` that renders every
 * Date as Vientiane-local `dd-MM-yyyy HH:mm:ss` — deliberately NOT ISO 8601
 * (see xs_backend/src/common/utils/date-serializer.util.ts). `new Date(s)` on
 * that string returns Invalid Date in every browser, so anything coming off
 * the chat / notification APIs has to go through here first.
 *
 * Asia/Vientiane is UTC+7 year-round with no DST, so the offset is a constant.
 */

const VIENTIANE_OFFSET_MINUTES = 7 * 60;

const VIENTIANE_FORMAT =
  /^(\d{2})-(\d{2})-(\d{4})[ T](\d{2}):(\d{2}):(\d{2})$/;

/**
 * Parse a date value returned by xs_backend into a real `Date`.
 *
 * Accepts the `dd-MM-yyyy HH:mm:ss` format the interceptor emits, and falls
 * back to native parsing for ISO strings / Date objects — rows written
 * directly by this website (Prisma) still come through as ISO in places, and
 * the socket gateway formats its own dates the same way as REST.
 *
 * Returns `null` for anything unparseable rather than an Invalid Date, so
 * callers get a value they can actually branch on.
 */
export function parseXsDate(value: unknown): Date | null {
  if (value == null) return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  if (typeof value === "number") {
    const fromEpoch = new Date(value);
    return Number.isNaN(fromEpoch.getTime()) ? null : fromEpoch;
  }
  if (typeof value !== "string") return null;

  const trimmed = value.trim();
  if (!trimmed) return null;

  const match = VIENTIANE_FORMAT.exec(trimmed);
  if (match) {
    const [, dd, mm, yyyy, hh, min, ss] = match;
    // Build the instant from UTC components, then subtract the Vientiane
    // offset — the string describes local Vientiane wall-clock time.
    const asUtc = Date.UTC(
      Number(yyyy),
      Number(mm) - 1,
      Number(dd),
      Number(hh),
      Number(min),
      Number(ss)
    );
    const parsed = new Date(asUtc - VIENTIANE_OFFSET_MINUTES * 60_000);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  const native = new Date(trimmed);
  return Number.isNaN(native.getTime()) ? null : native;
}

/**
 * Parse an xs_backend date and re-emit it as an ISO string, which is what the
 * website's own components (notification store, relative-time formatters)
 * expect. Falls back to "now" only when the value is missing entirely, so a
 * malformed timestamp never renders as "Invalid Date".
 */
export function xsDateToIso(value: unknown, fallback: Date = new Date()): string {
  return (parseXsDate(value) ?? fallback).toISOString();
}
