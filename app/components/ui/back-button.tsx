/**
 * Back button for pages reached from the header avatar rather than the bottom
 * bar (the profile pages), where there is no nav entry to return through.
 *
 * `navigate(-1)` alone is unsafe: if the page was opened directly — a shared
 * link, a refresh, a push-notification deep link, a new tab — there is no
 * in-app history entry and going back either leaves the site or does nothing.
 * React Router marks that first entry with `location.key === "default"`, so we
 * fall back to an explicit destination in that case.
 */

import { useLocation, useNavigate } from "react-router";
import { useTranslation } from "react-i18next";
import { ArrowLeft } from "lucide-react";

interface BackButtonProps {
  /** Where to go when there's no history to pop. */
  fallbackTo: string;
  className?: string;
}

export function BackButton({ fallbackTo, className = "" }: BackButtonProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation();

  const goBack = () => {
    if (location.key === "default") {
      navigate(fallbackTo);
    } else {
      navigate(-1);
    }
  };

  return (
    <button
      type="button"
      onClick={goBack}
      aria-label={t("common.back", { defaultValue: "Back" })}
      className={`inline-flex items-center justify-center gap-1.5 h-9 px-3 rounded-md cursor-pointer bg-rose-50 border border-rose-100 text-rose-500 text-sm font-medium hover:bg-rose-100 transition-all duration-150 active:scale-[0.97] ${className}`}
    >
      <ArrowLeft className="w-4 h-4" />
      <span suppressHydrationWarning>
        {t("common.back", { defaultValue: "Back" })}
      </span>
    </button>
  );
}
