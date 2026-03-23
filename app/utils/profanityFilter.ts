/**
 * Profanity filter for English, Thai, and Lao languages.
 * Checks for profanity, insults, harassment, and toxic language.
 * Handles common evasion techniques (spacing, symbol substitution).
 *
 * Words are split into two categories:
 * - "exact" words: short/common words that must match as standalone (not inside other words)
 * - "contains" words: longer/unique words that can be matched anywhere via substring
 */

// ==================== English ====================

// Short English words — require word boundary matching
const ENGLISH_EXACT = [
  "fuck",
  "shit",
  "bitch",
  "dick",
  "pussy",
  "cock",
  "cunt",
  "slut",
  "whore",
  "hoe",
  "thot",
  "twat",
  "prick",
  "stfu",
  "gtfo",
  "wtf",
  "fck",
  "fuk",
  "fuq",
  "damn",
  "piss",
  "crap",
  "kys",
  "kms",
];

// Longer English phrases — safe to substring match
const ENGLISH_CONTAINS = [
  "asshole",
  "bastard",
  "nigger",
  "nigga",
  "faggot",
  "retard",
  "motherfucker",
  "bullshit",
  "douche",
  "wanker",
  "skank",
  "suck my",
  "blow me",
  "eat shit",
  "go die",
  "kill yourself",
];

// ==================== Thai ====================

// Short Thai words — require standalone matching
const THAI_EXACT = [
  "ควย",
  "หี",
  "เย็ด",
  "แม่ง",
  "สัส",
  "แดก",
  "เชี่ย",
  "ห่า",
  "หมอย",
];

// Longer Thai phrases — safe to substring match
const THAI_CONTAINS = [
  "เหี้ย",
  "อีดอก",
  "อีสัตว์",
  "อีเหี้ย",
  "อีควาย",
  "อีหน้าหี",
  "ไอ้สัตว์",
  "ไอ้เหี้ย",
  "ไอ้ควาย",
  "ไอ้บ้า",
  "ไอ้โง่",
  "กระหรี่",
  "อีกระหรี่",
  "หน้าหี",
  "หน้าควย",
  "ชิบหาย",
  "ไอ้หน้าหี",
  "ไอ้หน้าควย",
  "อีดอกทอง",
  "สันดาน",
  "ชาติชั่ว",
  "ไอ้ชาติหมา",
  "อีช้างเย็ด",
  "ส้นตีน",
  "หน้าด้าน",
];

// ==================== Lao ====================

// Short Lao words — require standalone matching
const LAO_EXACT = ["ຄວຍ", "ເຫຍດ", "ເຍັດ", "ແມ່ງ", "ແດກ", "ສີ້"];

// Longer Lao phrases — safe to substring match
const LAO_CONTAINS = [
  "ອີ່ສັດ",
  "ອີ່ເຫຍ",
  "ອີ່ຄວາຍ",
  "ໄອ້ສັດ",
  "ໄອ້ເຫຍ",
  "ໄອ້ຄວາຍ",
  "ໄອ້ບ້າ",
  "ໄອ້ໂງ່",
  "ກະຫຼີ່",
  "ອີ່ກະຫຼີ່",
  "ອີ່ດອກ",
  "ອີ່ຫນ້າຫີ",
  "ສັນດານ",
  "ຊາດຊົ່ວ",
  "ໄອ້ຊາດໝາ",
  "ໜ້າຫີ",
  "ໜ້າຄວຍ",
  "ຊິບຫາຍ",
  "ອີ່ດອກທອງ",
  "ສົ້ນຕີນ",
  "ໜ້າດ້ານ",
  "ອີ່ໝາ",
  "ໄອ້ໝາ",
  "ມີເພດສຳພັນ",
  "ນົມໃຫຍ່",
  "ໂຄຍໃຫຍ່",
  "ນອນນໍາກັນ",
  "ນອນ",
  "ສີ້ກັນ",
  "ກົ້ນໃຫຍ່",
  "ຫີ",
  "ຫີໃຫຍ່",
  "ໂຄຍ",
  "ອົມ",
  "ເລຍ",
  "ຫອຍ",
];

// Common character substitutions for evasion (English only)
const CHAR_MAP: Record<string, string> = {
  "@": "a",
  "4": "a",
  "3": "e",
  "1": "i",
  "!": "i",
  "0": "o",
  $: "s",
  "5": "s",
  "+": "t",
  "7": "t",
  "*": "",
  "#": "",
  "-": "",
  _: "",
  ".": "",
};

/**
 * Normalize text by removing evasion techniques (for English)
 */
function normalizeText(text: string): string {
  let normalized = text.toLowerCase();
  for (const [char, replacement] of Object.entries(CHAR_MAP)) {
    normalized = normalized.split(char).join(replacement);
  }
  // Collapse single-char spacing: "f u c k" → "fuck"
  normalized = normalized.replace(/\b(\w)\s+(?=\w\b)/g, "$1");
  return normalized;
}

/**
 * Check if a word appears as a standalone token in text.
 * For English: uses word boundaries (\b).
 * For Thai/Lao: checks that the word is surrounded by spaces, punctuation, or start/end of string.
 */
function matchExact(
  text: string,
  word: string,
  lang: "en" | "th" | "lo"
): boolean {
  if (lang === "en") {
    const regex = new RegExp(`\\b${escapeRegex(word)}\\b`, "i");
    return regex.test(text);
  }
  // For Thai/Lao: match word surrounded by whitespace, punctuation, or string boundaries
  const regex = new RegExp(
    `(?:^|[\\s.,!?;:()\\[\\]{}\"'\\-])${escapeRegex(word)}(?:$|[\\s.,!?;:()\\[\\]{}\"'\\-])`
  );
  return regex.test(text);
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export interface ProfanityResult {
  blocked: boolean;
  matchedWord?: string;
}

/**
 * Check if text contains any profanity.
 * Returns { blocked: true, matchedWord: "..." } if profanity found,
 * or { blocked: false } if clean.
 */
export function checkProfanity(text: string): ProfanityResult {
  if (!text || !text.trim()) {
    return { blocked: false };
  }

  const original = text.toLowerCase();
  const normalized = normalizeText(text);
  const noSpaces = normalized.replace(/\s+/g, "");

  // --- English exact words (word boundary) ---
  for (const word of ENGLISH_EXACT) {
    if (
      matchExact(original, word, "en") ||
      matchExact(normalized, word, "en") ||
      noSpaces.includes(word.replace(/\s+/g, ""))
    ) {
      return { blocked: true, matchedWord: word };
    }
  }

  // --- English contains words (substring) ---
  for (const word of ENGLISH_CONTAINS) {
    const flat = word.replace(/\s+/g, "");
    if (
      original.includes(word) ||
      normalized.includes(flat) ||
      noSpaces.includes(flat)
    ) {
      return { blocked: true, matchedWord: word };
    }
  }

  // --- Thai exact words ---
  for (const word of THAI_EXACT) {
    if (matchExact(original, word, "th")) {
      return { blocked: true, matchedWord: word };
    }
  }

  // --- Thai contains words ---
  for (const word of THAI_CONTAINS) {
    if (original.includes(word)) {
      return { blocked: true, matchedWord: word };
    }
  }

  // --- Lao exact words ---
  for (const word of LAO_EXACT) {
    if (matchExact(original, word, "lo")) {
      return { blocked: true, matchedWord: word };
    }
  }

  // --- Lao contains words ---
  for (const word of LAO_CONTAINS) {
    if (original.includes(word)) {
      return { blocked: true, matchedWord: word };
    }
  }

  return { blocked: false };
}

/**
 * Check if text contains a phone number.
 * Strips all non-digit characters, then checks for sequences of 7+ digits.
 * Catches formats like: 55892057, 020 5589 2057, +856 20 55892057, 20-5589-2057, etc.
 */
export function containsPhoneNumber(text: string): boolean {
  if (!text) return false;
  // Extract all digit sequences from the text and join them
  const digitsOnly = text.replace(/[^\d]/g, "");
  // If total digits in text is 7 or more, likely contains a phone number
  if (digitsOnly.length >= 7) return true;
  // Also check for digit sequences with separators (spaces, dashes, dots)
  const phonePattern = /\d[\d\s\-\.]{5,}\d/;
  return phonePattern.test(text);
}
