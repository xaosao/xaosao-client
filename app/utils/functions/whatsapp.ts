/**
 * Open WhatsApp chat.
 * On mobile: uses direct link (no target="_blank" which Safari blocks).
 * On desktop: opens in new tab.
 */
export function openWhatsApp(number: number | string, message?: string) {
  const url = message
    ? `https://wa.me/${number}?text=${encodeURIComponent(message)}`
    : `https://wa.me/${number}`;

  const isMobile = /iPhone|iPad|iPod|Android/i.test(
    typeof navigator !== "undefined" ? navigator.userAgent : ""
  );

  if (isMobile) {
    // On mobile, open in same tab — WhatsApp app will intercept the URL
    // Using setTimeout to avoid iOS blocking the navigation
    setTimeout(() => {
      window.location.assign(url);
    }, 100);
  } else {
    window.open(url, "_blank");
  }
}
