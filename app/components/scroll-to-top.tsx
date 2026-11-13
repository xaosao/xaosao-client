import { useEffect, useState } from "react";
import { useLocation } from "react-router";
import { useTranslation } from "react-i18next";
import { ArrowUp } from "lucide-react";

/**
 * Floating scroll-to-top button.
 *
 * Fixed to the bottom-right of the viewport. Hidden by default; fades
 * in once the user has scrolled past `showAfter` pixels from the top.
 * Clicking smooth-scrolls back to the top.
 *
 * Mount once, near the root layout, so it appears on every page.
 * Respects `prefers-reduced-motion` for the scroll behavior itself
 * (the browser handles this automatically for `behavior: 'smooth'`).
 */
export function ScrollToTop({ showAfter = 320 }: { showAfter?: number }) {
  const { t } = useTranslation();
  const location = useLocation();
  const [visible, setVisible] = useState(false);

  /*
   * Never show this on a chat thread. Two reasons:
   *   1. It's `fixed bottom-right`, so it lands on top of the composer's
   *      send button.
   *   2. The thread scrolls its own inner container, not the window — so the
   *      button would scroll the wrong thing. It only appeared there at all
   *      because iOS scrolls the DOCUMENT to reveal the focused input, which
   *      pushed window.scrollY past the threshold.
   */
  const onChatThread = /^\/(customer|model)\/chat\/[^/]+/.test(
    location.pathname
  );

  /*
   * Inside the app shell there is a bottom tab bar, and this button was
   * landing on top of it — covering the last tab, Settings. On those
   * screens it rides above the bar instead (`above-tabbar` measures from
   * the same variable the bar's own height comes from, home-indicator
   * inset included). On the marketing pages, where there is no bar, it
   * stays in the corner where it belongs.
   */
  const insideAppShell =
    /^\/(customer|model)(\/|$)/.test(location.pathname) && !onChatThread;

  /*
   * Discover already parks the "ask an admin" button in this corner, so
   * there the scroll button takes the rung above it. Everywhere else it
   * sits directly above the tab bar.
   */
  const sharesCornerWithAssistant = /^\/customer\/?$/.test(location.pathname);

  useEffect(() => {
    if (onChatThread) {
      setVisible(false);
      return;
    }
    const onScroll = () => setVisible(window.scrollY > showAfter);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [showAfter, onChatThread]);

  if (onChatThread) return null;

  const handleClick = () => {
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label={t("footer.scrollTop", { defaultValue: "Scroll to top" })}
      aria-hidden={!visible}
      tabIndex={visible ? 0 : -1}
      className={`fixed right-4 sm:right-6 z-40 w-11 h-11 sm:w-12 sm:h-12 rounded-full bg-rose-500 hover:bg-rose-600 text-white flex items-center justify-center shadow-lg shadow-rose-500/25 transition-all duration-300 hover:scale-105 active:scale-90 ${
        insideAppShell
          ? `${sharesCornerWithAssistant ? "above-tabbar-2" : "above-tabbar"} sm:bottom-6`
          : "bottom-6"
      } ${
        visible
          ? "opacity-100 scale-100 pointer-events-auto"
          : "opacity-0 scale-75 pointer-events-none"
      }`}
    >
      <ArrowUp className="w-4 h-4 sm:w-5 sm:h-5" />
    </button>
  );
}
