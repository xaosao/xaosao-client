/**
 * Open WhatsApp chat - creates a temporary <a> tag to open the link.
 * This works on iOS Safari, Android, and desktop without causing cache issues.
 */
export function openWhatsApp(number: number | string, message?: string) {
  const url = message
    ? `https://wa.me/${number}?text=${encodeURIComponent(message)}`
    : `https://wa.me/${number}`;

  const a = document.createElement("a");
  a.href = url;
  a.target = "_blank";
  a.rel = "noopener noreferrer";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}
