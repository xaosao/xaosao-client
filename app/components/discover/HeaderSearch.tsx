/**
 * Search icon in the header, with a dropdown panel.
 *
 * Searches people by name or WhatsApp number. The query goes to a resource
 * route so the lookup runs server-side against Prisma — the WhatsApp number is
 * a searchable key but is never returned to the browser.
 */

import { useEffect, useRef, useState } from "react";
import { Link, useFetcher } from "react-router";
import { useTranslation } from "react-i18next";
import { Search, X, Loader2, MapPin } from "lucide-react";
import { formatDistance } from "./ProfileCard";

interface SearchResult {
  id: string;
  firstName: string | null;
  lastName: string | null;
  profile: string | null;
  distance: number | null;
}

interface HeaderSearchProps {
  /** Resource route that returns `{ results }`. */
  searchAction: string;
  /** Builds the link for a result row. */
  hrefFor: (id: string) => string;
  /**
   * "icon"  — a button that toggles a dropdown containing the input. Used in
   *           the mobile header, where there is no room for a text field.
   * "input" — the field is always visible; results drop below it. Used on
   *           desktop, where the header has space.
   */
  variant?: "icon" | "input";
  className?: string;
}

/** Below this the query matches too much to be useful. */
const MIN_QUERY = 2;
const DEBOUNCE_MS = 300;

export function HeaderSearch({
  searchAction,
  hrefFor,
  variant = "icon",
  className = "",
}: HeaderSearchProps) {
  const { t } = useTranslation();
  const fetcher = useFetcher<{ results: SearchResult[] }>();
  const isInline = variant === "input";
  // The inline field is always "open"; only the icon variant toggles.
  const [iconOpen, setIconOpen] = useState(false);
  const open = isInline || iconOpen;
  const setOpen = setIconOpen;
  const [query, setQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Debounce so typing doesn't fire a request per keystroke.
  useEffect(() => {
    if (!open) return;
    const trimmed = query.trim();
    if (trimmed.length < MIN_QUERY) return;

    const timer = setTimeout(() => {
      fetcher.load(`${searchAction}?q=${encodeURIComponent(trimmed)}`);
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
    // fetcher is intentionally excluded — it changes identity every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, open, searchAction]);

  // Close on outside click and on Escape. The inline field stays put — only
  // its results panel is dismissed, handled by clearing the query.
  useEffect(() => {
    if (!open || isInline) return;

    const onPointerDown = (event: MouseEvent | TouchEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("touchstart", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("touchstart", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  useEffect(() => {
    // Autofocus only when the dropdown was deliberately opened — focusing the
    // inline field on every page load would yank the keyboard up.
    if (iconOpen && !isInline) inputRef.current?.focus();
  }, [iconOpen, isInline]);

  const trimmed = query.trim();
  const results = fetcher.data?.results ?? [];
  const searching = fetcher.state !== "idle";
  const tooShort = trimmed.length > 0 && trimmed.length < MIN_QUERY;
  // Only claim "no results" once a completed search has come back for the
  // current query — otherwise it flashes while the request is still going.
  const noResults =
    !searching && trimmed.length >= MIN_QUERY && fetcher.data && results.length === 0;

  const showResultsPanel = isInline ? trimmed.length > 0 : open;

  return (
    <div className={`relative ${isInline ? "w-72" : ""} ${className}`} ref={containerRef}>
      {!isInline && (
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={t("discover.search", { defaultValue: "Search" })}
        aria-expanded={open}
        className={`h-9 w-9 rounded-full flex items-center justify-center transition-all duration-150 active:scale-90 ${
          open
            ? "bg-rose-100 text-rose-500"
            : "text-gray-600 hover:bg-rose-50 hover:text-rose-500"
        }`}
      >
        <Search className="h-5 w-5" />
      </button>
      )}

      {/* Inline (desktop): the field lives in the header itself. */}
      {isInline && (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            ref={inputRef}
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t("discover.searchPlaceholder", {
              defaultValue: "Name or WhatsApp number",
            })}
            className="w-full pl-9 pr-9 py-2 text-sm bg-gray-50 border border-gray-200 rounded-full focus:outline-none focus:ring-2 focus:ring-rose-200 focus:bg-white transition-colors"
            suppressHydrationWarning
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              aria-label={t("common.clear", { defaultValue: "Clear" })}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      )}

      {showResultsPanel && (
        <div className={`absolute right-0 z-50 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden ${isInline ? "top-12 w-full" : "top-11 w-[min(20rem,calc(100vw-2rem))]"}`}>
          {!isInline && (
          <div className="p-2 border-b">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                ref={inputRef}
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={t("discover.searchPlaceholder", {
                  defaultValue: "Name or WhatsApp number",
                })}
                className="w-full pl-8 pr-8 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-200"
                suppressHydrationWarning
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  aria-label={t("common.clear", { defaultValue: "Clear" })}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
          )}

          <div className="max-h-72 overflow-y-auto">
            {trimmed.length === 0 && (
              <p className="px-3 py-6 text-center text-xs text-gray-400">
                {t("discover.searchHint", {
                  defaultValue: "Search by name or WhatsApp number",
                })}
              </p>
            )}

            {tooShort && (
              <p className="px-3 py-6 text-center text-xs text-gray-400">
                {t("discover.searchTooShort", {
                  defaultValue: "Type at least 2 characters",
                })}
              </p>
            )}

            {searching && (
              <p className="px-3 py-6 flex items-center justify-center text-xs text-gray-400 gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                {t("chat.loading", { defaultValue: "Loading…" })}
              </p>
            )}

            {noResults && (
              <p className="px-3 py-6 text-center text-xs text-gray-400">
                {t("discover.searchNoResults", { defaultValue: "No one found" })}
              </p>
            )}

            {!searching &&
              results.map((result) => {
                const name =
                  [result.firstName, result.lastName].filter(Boolean).join(" ") ||
                  "XaoSao";
                const distance = formatDistance(result.distance);
                return (
                  <Link
                    key={result.id}
                    to={hrefFor(result.id)}
                    onClick={() => setOpen(false)}
                    className="flex items-center gap-3 px-3 py-2.5 hover:bg-rose-50/60 transition-colors"
                  >
                    {result.profile ? (
                      <img
                        src={result.profile}
                        alt={name}
                        loading="lazy"
                        className="w-9 h-9 rounded-full object-cover border border-gray-200"
                      />
                    ) : (
                      <div className="w-9 h-9 rounded-full bg-rose-100 flex items-center justify-center text-rose-500 text-sm font-medium">
                        {name.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{name}</p>
                      {distance && (
                        <p className="text-[11px] text-gray-400 flex items-center gap-0.5">
                          <MapPin className="w-3 h-3" />
                          {distance}
                        </p>
                      )}
                    </div>
                  </Link>
                );
              })}
          </div>
        </div>
      )}
    </div>
  );
}
