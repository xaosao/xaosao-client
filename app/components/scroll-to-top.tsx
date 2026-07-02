import { useEffect, useState } from "react";
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
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > showAfter);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [showAfter]);

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
      className={`fixed bottom-6 right-6 z-40 w-11 h-11 sm:w-12 sm:h-12 rounded-full bg-rose-500 hover:bg-rose-600 text-white flex items-center justify-center shadow-lg shadow-rose-500/25 transition-all duration-300 hover:scale-105 ${
        visible
          ? "opacity-100 translate-y-0 pointer-events-auto"
          : "opacity-0 translate-y-4 pointer-events-none"
      }`}
    >
      <ArrowUp className="w-4 h-4 sm:w-5 sm:h-5" />
    </button>
  );
}
