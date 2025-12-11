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

export function extractFilenameFromCDNSafe(url: string): string {
  if (!url || typeof url !== "string") {
    return "";
  }
  try {
    const urlParts = url.split("/");
    const filename = urlParts[urlParts.length - 1] || "";
    return filename.split("?")[0];
  } catch (error) {
    console.error("Error extracting filename from URL:", error);
    return "";
  }
}
