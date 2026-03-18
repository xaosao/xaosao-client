export const capitalize = (str: string) => {
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
};

export function getFirstWord(text: string): string {
  if (!text) return "";
  return text.trim().split(" ")[0];
}

export type TruncateOptions = {
  wholeWord?: boolean; // avoid cutting in the middle of a word
  ellipsis?: string; // what to append when truncated (default: "…")
  preserveCase?: boolean; // no-op here but handy for future rules
};

export function truncateText(
  input: string | null | undefined,
  maxLen: number,
  options: TruncateOptions = {}
): string {
  const { wholeWord = true, ellipsis = "…" } = options;

  if (!input || maxLen <= 0) return "";
  if (input.length <= maxLen) return input;

  const target = input.slice(0, Math.max(0, maxLen));

  if (!wholeWord) {
    // direct cut
    return target + ellipsis;
  }

  // Try to cut at the last whitespace before maxLen
  const lastSpace = target.search(/\s\S*$/) > -1 ? target.lastIndexOf(" ") : -1;
  if (lastSpace > 0) {
    return target.slice(0, lastSpace).trimEnd() + ellipsis;
  }

  // No whitespace found, fallback to hard cut
  return target + ellipsis;
}

/**
 * Extract the storage path from a CDN URL for BunnyCDN operations.
 * Supports both flat files (legacy) and folder-structured paths (new).
 *
 * Example:
 *   "https://cdn.example.com/1710729600-profile.jpg" → "1710729600-profile.jpg"
 *   "https://cdn.example.com/c-abc123-john/profile/avatar-1710729600.jpg" → "c-abc123-john/profile/avatar-1710729600.jpg"
 */
export function extractFilenameFromCDNSafe(url: string): string {
  if (!url || typeof url !== "string") {
    return "";
  }
  try {
    const parsed = new URL(url);
    // pathname starts with "/" so remove it; also strip query params
    return parsed.pathname.substring(1).split("?")[0];
  } catch {
    // Fallback: if not a valid URL, return as-is (minus query params)
    return url.split("?")[0];
  }
}
