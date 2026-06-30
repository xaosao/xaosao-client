import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ChevronDown, Check } from "lucide-react";

const languages = [
  { code: "en", name: "English", flag: "🇺🇸" },
  { code: "lo", name: "ລາວ", flag: "🇱🇦" },
  { code: "th", name: "ไทย", flag: "🇹🇭" },
];

/**
 * Pretty pill-style language switcher with a dropdown menu.
 *
 * Uses a tiny custom popover (no shadcn Select chrome) so the trigger
 * blends with the editorial header. Outside-click + Escape close the
 * menu; selected language gets a check mark next to it.
 */
export default function LanguageSwitcher() {
  const { i18n } = useTranslation();
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const current =
    languages.find((l) => l.code === i18n.language) ?? languages[0];

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (!wrapperRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const handleSelect = (code: string) => {
    i18n.changeLanguage(code);
    try {
      localStorage.setItem("i18nextLng", code);
    } catch {
      /* iOS Safari private mode */
    }
    setOpen(false);
  };

  return (
    <div ref={wrapperRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="group inline-flex items-center gap-2 hover:bg-gray-50 text-gray-900 p-2 rounded-md text-xs sm:text-sm font-semibold shadow-sm ring-1 ring-rose-400 transition-all hover:ring-rose-500 cursor-pointer"
      >
        <span className="text-base leading-none">{current.flag}</span>
        <span className="hidden sm:inline">{current.name}</span>
        <ChevronDown
          className={`w-3.5 h-3.5 text-rose-600 transition-transform ${open ? "rotate-180" : ""
            }`}
        />
      </button>

      {open && (
        <div
          role="listbox"
          className="absolute right-0 top-full mt-2 w-44 bg-white rounded-2xl shadow-xl ring-1 ring-black/5 py-1.5 z-50 origin-top-right animate-in fade-in"
        >
          {languages.map((lang) => {
            const active = lang.code === i18n.language;
            return (
              <button
                key={lang.code}
                role="option"
                aria-selected={active}
                onClick={() => handleSelect(lang.code)}
                className={`w-full flex items-center justify-between gap-3 px-3 py-2 text-sm transition-colors ${active
                  ? "text-rose-600 bg-rose-50"
                  : "text-gray-700 hover:bg-gray-50"
                  }`}
              >
                <span className="flex items-center gap-2.5">
                  <span className="text-base leading-none">{lang.flag}</span>
                  <span className="font-medium">{lang.name}</span>
                </span>
                {active && <Check className="w-4 h-4 text-rose-500" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
