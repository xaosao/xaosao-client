import { useEffect, useRef, useState } from "react";
import { useFetcher } from "react-router";
import { useTranslation } from "react-i18next";
import { Bot, MessageCircle, Send, Star, UserRound, X } from "lucide-react";

import type {
  AssistantHistoryMessage,
  AssistantMatch,
  AssistantReply,
  AssistantTurn,
} from "~/services/assistant.server";
import { BookingFlow } from "./BookingFlow";

/**
 * "Find someone for me" — a chat sheet over the discover page.
 *
 * The customer describes who they are looking for in their own words.
 * Claude turns that into filters on the server, the database does the
 * matching, and the results come back as cards rendered two to a row.
 */
export function AssistantSheet({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  const fetcher = useFetcher<AssistantReply>();
  // Past turns, including anything an admin picked by hand while the
  // customer was away.
  const history = useFetcher<{ messages: AssistantHistoryMessage[] }>();
  const [draft, setDraft] = useState("");
  // The person currently being booked. Non-null means the wizard is open
  // in place of the composer — one booking at a time, so the customer is
  // never half-way through two.
  const [booking, setBooking] = useState<AssistantMatch | null>(null);
  const [turns, setTurns] = useState<
    Array<AssistantTurn & { matches?: AssistantMatch[] }>
  >([
    { role: "assistant", text: t("assistant.greeting") },
  ]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const busy = fetcher.state !== "idle";

  // Load the saved thread once, when the sheet opens.
  useEffect(() => {
    if (history.state === "idle" && !history.data) {
      history.load("/customer/assistant");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Replace the greeting with the real thread when it arrives, so a
  // suggestion an admin sent while the customer was away is waiting.
  useEffect(() => {
    const saved = history.data?.messages;
    if (!saved || saved.length === 0) return;
    setTurns(
      saved.map((m) => ({
        // An admin pick renders like an assistant turn — the customer
        // does not need to care which side chose it.
        role: m.role === "user" ? ("user" as const) : ("assistant" as const),
        text: m.text,
        matches: m.matches ?? undefined,
      })),
    );
  }, [history.data]);

  // Append the reply once, when a response lands.
  useEffect(() => {
    if (!fetcher.data || busy) return;
    setTurns((current) => {
      const last = current[current.length - 1];
      if (last?.role === "assistant" && last.text === fetcher.data!.reply) {
        return current;
      }
      return [
        ...current,
        {
          role: "assistant",
          text: fetcher.data!.reply,
          matches: fetcher.data!.matches,
        },
      ];
    });
  }, [fetcher.data, busy]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [turns, busy]);

  function send(event: React.FormEvent) {
    event.preventDefault();
    submitMessage(draft);
  }

  /**
   * Shared by the composer and the quick-question chips, so a tapped
   * suggestion travels exactly the same path as a typed message.
   */
  function submitMessage(raw: string) {
    const message = raw.trim();
    if (!message || busy) return;

    // Send the history BEFORE this message, so the server sees the same
    // conversation the customer does.
    const history = turns.map(({ role, text }) => ({ role, text }));
    setTurns((current) => [...current, { role: "user", text: message }]);
    setDraft("");

    const form = new FormData();
    form.set("message", message);
    form.set("history", JSON.stringify(history));
    fetcher.submit(form, { method: "post", action: "/customer/assistant" });
  }

  return (
    <div className="fixed inset-0 z-[9000] flex items-stretch justify-center bg-black/50 sm:items-center">
      <div className="flex h-[100dvh] w-full max-w-md flex-col bg-white shadow-2xl sm:h-[92vh] sm:rounded-2xl">
        <header className="flex items-center justify-between border-b px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-rose-100">
              <MessageCircle className="h-4 w-4 text-rose-500" />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900">
                {t("assistant.sheetTitle")}
              </p>
              <p className="text-[11px] text-gray-500">{t("assistant.sheetHint")}</p>
            </div>
          </div>
          <button onClick={onClose} aria-label="Close" className="rounded-full p-1 hover:bg-gray-100">
            <X className="h-5 w-5 text-gray-400" />
          </button>
        </header>

        <div
          ref={scrollRef}
          className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-4 py-4"
        >
          {turns.map((turn, index) => (
            <div key={index}>
              <div className={turn.role === "user" ? "flex justify-end" : "flex gap-2"}>
                {turn.role === "assistant" && (
                  <div className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gray-100">
                    <Bot className="h-3 w-3 text-gray-500" />
                  </div>
                )}
                <p
                  className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${
                    turn.role === "user"
                      ? "bg-rose-500 text-white"
                      : "bg-gray-100 text-gray-800"
                  }`}
                >
                  {turn.text}
                </p>
              </div>

              {/* Two cards per row, as asked. */}
              {turn.matches && turn.matches.length > 0 && (
                <div className="mt-3 grid grid-cols-2 gap-2">
                  {turn.matches.map((match) => (
                    <MatchCard
                      key={match.id}
                      match={match}
                      onBook={() => setBooking(match)}
                    />
                  ))}
                </div>
              )}
            </div>
          ))}

          {turns.length === 1 && !busy && (
            <div className="space-y-2 pt-1">
              <p className="text-[11px] font-medium text-gray-400">
                {t("assistant.tryAsking")}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {["q1", "q2", "q3", "q4"].map((key) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => submitMessage(t(`assistant.${key}`))}
                    className="rounded-full border border-rose-200 bg-rose-50 px-3 py-1.5 text-[11px] text-rose-700 hover:bg-rose-100"
                  >
                    {t(`assistant.${key}`)}
                  </button>
                ))}
              </div>
            </div>
          )}

          {busy && (
            <div className="flex gap-2">
              <div className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gray-100">
                <Bot className="h-3 w-3 text-gray-500" />
              </div>
              <p className="rounded-2xl bg-gray-100 px-3 py-2 text-sm text-gray-400">
                {t("assistant.thinking")}
              </p>
            </div>
          )}
        </div>

        {booking && (
          <div className="max-h-[60%] shrink-0 overflow-y-auto overscroll-contain border-t px-3 py-3">
            <BookingFlow
              match={booking}
              onCancel={() => setBooking(null)}
              onBooked={(price) => {
                setBooking(null);
                setTurns((current) => [
                  ...current,
                  {
                    role: "assistant",
                    text: t("assistant.booking.booked", {
                      price: price.toLocaleString(),
                    }),
                  },
                ]);
              }}
            />
          </div>
        )}

        {!booking && (
        <form
          onSubmit={send}
          className="flex shrink-0 items-center gap-2 border-t px-3 py-3"
        >
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={t("assistant.placeholder")}
            className="flex-1 rounded-full border border-gray-200 px-4 py-2 text-sm focus:border-rose-300 focus:outline-none focus:ring-2 focus:ring-rose-200"
          />
          <button
            type="submit"
            disabled={busy || !draft.trim()}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-rose-500 text-white disabled:opacity-50"
            aria-label="Send"
          >
            <Send className="h-4 w-4" />
          </button>
        </form>
        )}
      </div>
    </div>
  );
}

/** One labelled line on a card: "Name  Somchai", "Distance  2.4 km". */
function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-baseline gap-1 text-[11px]">
      <span className="shrink-0 text-gray-400">{label}:</span>
      <span className="min-w-0 truncate">{children}</span>
    </div>
  );
}

function MatchCard({
  match,
  onBook,
}: {
  match: AssistantMatch;
  onBook: () => void;
}) {
  const { t } = useTranslation();
  // A profile URL can 404 — an image that fails to load was rendering a
  // whole error page inside the card. Swap to the placeholder instead.
  const [imageFailed, setImageFailed] = useState(false);
  const showImage = match.profile && !imageFailed;

  return (
    <div className="overflow-hidden rounded-xl border border-gray-200">
      {showImage ? (
        <img
          src={match.profile!}
          alt={match.name}
          onError={() => setImageFailed(true)}
          className="h-28 w-full bg-gray-100 object-cover"
        />
      ) : (
        <div className="flex h-28 w-full items-center justify-center bg-gray-100">
          <UserRound className="h-8 w-8 text-gray-300" />
        </div>
      )}
      <div className="space-y-1 p-2">
        <Field label={t("assistant.name")}>
          <span className="truncate font-semibold text-gray-900">
            {match.name}
          </span>
        </Field>

        {match.age != null && (
          <Field label={t("assistant.age")}>
            <span className="text-gray-700">{match.age}</span>
          </Field>
        )}

        {match.distanceKm != null && (
          <Field label={t("assistant.distance")}>
            <span className="text-gray-700">
              {match.distanceKm < 1
                ? `${Math.round(match.distanceKm * 1000)} m`
                : `${match.distanceKm} km`}
            </span>
          </Field>
        )}

        {match.rating > 0 && (
          <span className="flex items-center gap-0.5 text-[11px] text-gray-500">
            <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
            {match.rating.toFixed(1)}
          </span>
        )}
        <button
          onClick={onBook}
          className="w-full rounded-lg bg-rose-500 py-1.5 text-[11px] font-semibold text-white hover:bg-rose-600"
        >
          {t("assistant.book")}
        </button>
      </div>
    </div>
  );
}
