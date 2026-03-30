/**
 * Open WhatsApp chat - uses window.location.href on mobile (iOS Safari blocks window.open)
 */
export function openWhatsApp(number: number | string, message?: string) {
  const url = message
    ? `https://wa.me/${number}?text=${encodeURIComponent(message)}`
    : `https://wa.me/${number}`;

  const isMobile = /iPhone|iPad|iPod|Android/i.test(
    typeof navigator !== "undefined" ? navigator.userAgent : ""
  );

  if (isMobile) {
    window.location.href = url;
  } else {
    window.open(url, "_blank");
  }
}
