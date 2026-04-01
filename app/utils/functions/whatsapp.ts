/**
 * Open WhatsApp chat without navigating away from the current page.
 * On iOS Safari: uses window.open (must be called from user gesture context).
 * On Android: uses window.open with fallback.
 * On desktop: opens in new tab.
 */
export function openWhatsApp(number: number | string, message?: string) {
  const url = message
    ? `https://api.whatsapp.com/send?phone=${number}&text=${encodeURIComponent(message)}`
    : `https://api.whatsapp.com/send?phone=${number}`;

  // window.open in the same call stack as user click event is NOT blocked by Safari.
  // This opens WhatsApp in a new tab/app without replacing the current page.
  // When the user returns, the app page is still intact.
  const newWindow = window.open(url, "_blank");

  // If popup was blocked (shouldn't happen when called from click handler),
  // fall back to location.href as last resort.
  if (!newWindow) {
    window.location.href = url;
  }
}
