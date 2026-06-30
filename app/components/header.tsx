import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { useTranslation } from "react-i18next";
import { Download } from "lucide-react";
import LanguageSwitcher from "./LanguageSwitcher";

/**
 * Top navigation — editorial style.
 *
 * - Small XaoSao logo + wordmark (text, not the image)
 * - Pretty pill-style language switcher
 * - "Download app" CTA next to it
 * - Transparent at top; on scroll, switches to white background with a
 *   soft bottom shadow (no rose color flash like the old behavior)
 */
export function Header() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setIsScrolled(window.scrollY > 10);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <nav
      className={`fixed top-0 w-full z-50 transition-all duration-300 ${isScrolled
        ? "bg-white/90 backdrop-blur-md shadow-[0_4px_20px_-8px_rgba(0,0,0,0.08)]"
        : "bg-transparent"
        }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Brand — small icon + text wordmark */}
          <button
            onClick={() => navigate("/")}
            className="group flex items-center gap-2.5"
          >
            <img
              src="/images/icon.png"
              alt="XaoSao"
              width={32}
              height={32}
              className="w-8 h-8 rounded-lg shadow-sm ring-1 ring-black/5"
            />
            <span className="flex font-serif text-xl text-gray-900 tracking-tight font-semibold">
              Xaosao<span className="hidden sm:block text-rose-500">-ເຊົ່າສາວ</span>
            </span>
          </button>

          {/* Right side */}
          <div className="flex items-center gap-2 sm:gap-3">
            <LanguageSwitcher />

            <a
              href="#download"
              onClick={(e) => {
                e.preventDefault();
                const el = document.getElementById("download");
                if (el) {
                  el.scrollIntoView({ behavior: "smooth", block: "start" });
                }
              }}
              className="group inline-flex items-center gap-1.5 sm:gap-2 bg-rose-500 hover:bg-rose-600 text-white px-3.5 sm:px-4 py-2 rounded-full text-xs sm:text-sm font-semibold shadow-md shadow-rose-500/20 transition-all hover:shadow-lg hover:shadow-rose-500/30 hover:scale-[1.03]"
            >
              <Download className="w-3.5 h-3.5 sm:w-4 sm:h-4 animate-bounce" />
              <span className="hidden sm:inline">
                {t("header.downloadApp", { defaultValue: "Download app" })}
              </span>
              <span className="sm:hidden">
                {t("header.download", { defaultValue: "App" })}
              </span>
            </a>
          </div>
        </div>
      </div>
    </nav>
  );
}
