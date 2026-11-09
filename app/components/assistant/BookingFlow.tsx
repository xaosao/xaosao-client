import { useEffect, useMemo, useState } from "react";
import { useFetcher, useNavigate } from "react-router";
import { useTranslation } from "react-i18next";
import { CalendarDays, Loader2, MapPin, Wallet } from "lucide-react";

import type { AssistantMatch } from "~/services/assistant.server";
import type {
  BookableService,
  BookableVariant,
  CustomerFunds,
  SessionKind,
} from "~/services/assistant-booking.server";

type Step =
  | "service"
  | "variant"
  | "when"
  | "duration"
  | "session"
  | "where"
  | "confirm";

/**
 * Booking, collected inside the chat.
 *
 * The structured answers are tapped rather than typed. A service maps to
 * an exact id and a date decides a real payment, so neither is worth
 * guessing at from free text — especially across Lao, Thai and English.
 * Only the location, which is genuinely free-form, is a text field.
 *
 * The steps follow the service's billing type, the same way the booking
 * screen does: hours for per_hour (with a massage variant first, when the
 * model sells them), minutes for per_minute, days for per_day, and
 * one-time or overnight for per_session.
 *
 * No price is computed here. Every figure shown comes back from the
 * server, which prices the booking with the booking engine's own
 * function, and every value is re-validated and re-priced there before
 * the booking is created.
 */
export function BookingFlow({
  match,
  onCancel,
  onBooked,
}: {
  match: AssistantMatch;
  onCancel: () => void;
  onBooked: (price: number) => void;
}) {
  const { t } = useTranslation();
  const services = useFetcher<{ services: BookableService[] }>();
  const pricing = useFetcher<{
    price?: number;
    funds?: CustomerFunds;
    error?: string;
  }>();
  const booking = useFetcher<{
    booked?: boolean;
    needsDeposit?: boolean;
    price?: number;
    funds?: CustomerFunds;
    error?: string;
  }>();
  const navigate = useNavigate();

  const [step, setStep] = useState<Step>("service");
  const [service, setService] = useState<BookableService | null>(null);
  const [variant, setVariant] = useState<BookableVariant | null>(null);
  const [when, setWhen] = useState("");
  const [units, setUnits] = useState(1);
  const [sessionType, setSessionType] = useState<SessionKind>("one_time");
  const [where, setWhere] = useState("");

  // Load this model's services once.
  useEffect(() => {
    const form = new FormData();
    form.set("intent", "services");
    form.set("modelId", match.id);
    services.submit(form, { method: "post", action: "/customer/assistant" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [match.id]);

  useEffect(() => {
    if (booking.data?.booked) onBooked(booking.data.price ?? 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [booking.data]);

  const list = services.data?.services ?? [];
  const billing = service?.billingType ?? null;
  const perHour = billing === "per_hour";
  const perMinute = billing === "per_minute";
  const perDay = billing === "per_day";
  const perSession = billing === "per_session";

  /** Which duration chips to offer, and what each one means. */
  const durations = useMemo(() => {
    if (perMinute) return [15, 30, 60, 90];
    if (perDay) return [1, 2, 3, 5];
    return [1, 2, 3, 4]; // hours
  }, [perMinute, perDay]);

  function unitLabel(n: number) {
    if (perMinute) return t("assistant.booking.minuteUnit", { count: n });
    if (perDay) return t("assistant.booking.dayUnit", { count: n });
    return t("assistant.booking.hourUnit", { count: n });
  }

  /** After the date, where to go depends on how the service is sold. */
  function afterWhen(): Step {
    if (perSession) return "session";
    return "duration";
  }

  function chooseService(picked: BookableService) {
    setService(picked);
    setVariant(null);
    setUnits(picked.billingType === "per_minute" ? 30 : 1);
    // Massage is sold per variant, so that choice comes before the rest.
    setStep(picked.variants.length > 0 ? "variant" : "when");
  }

  /** Ask the server what this costs, then show the summary. */
  function askForPrice() {
    if (!service) return;
    const form = new FormData();
    form.set("intent", "quote");
    form.set("modelId", match.id);
    form.set("modelServiceId", service.modelServiceId);
    form.set("units", String(units));
    form.set("sessionType", sessionType);
    if (variant) form.set("modelServiceVariantId", variant.id);
    pricing.submit(form, { method: "post", action: "/customer/assistant" });
    setStep("confirm");
  }

  function confirm() {
    if (!service) return;
    const form = new FormData();
    form.set("intent", "book");
    form.set("modelId", match.id);
    form.set("modelServiceId", service.modelServiceId);
    form.set("startDate", when);
    form.set("units", String(units));
    form.set("sessionType", sessionType);
    form.set("location", where);
    if (variant) form.set("modelServiceVariantId", variant.id);
    booking.submit(form, { method: "post", action: "/customer/assistant" });
  }

  const funds = booking.data?.funds ?? pricing.data?.funds;
  const price = booking.data?.price ?? pricing.data?.price;
  const short = booking.data?.needsDeposit || funds?.short;

  return (
    <div className="rounded-xl border border-rose-200 bg-rose-50/60 p-3">
      <p className="mb-2 text-xs font-semibold text-gray-900">
        {t("assistant.booking.title", { name: match.name })}
      </p>

      {step === "service" && (
        <Section label={t("assistant.booking.service")}>
          {services.state !== "idle" && <Spinner />}
          {services.state === "idle" && list.length === 0 && (
            <p className="text-xs text-gray-500">
              {t("assistant.booking.noServices")}
            </p>
          )}
          <div className="flex flex-wrap gap-1">
            {list.map((s) => (
              <Chip key={s.modelServiceId} onClick={() => chooseService(s)}>
                {s.name}
              </Chip>
            ))}
          </div>
        </Section>
      )}

      {step === "variant" && service && (
        <Section label={t("assistant.booking.kind")}>
          <div className="flex flex-wrap gap-1">
            {service.variants.map((v) => (
              <Chip
                key={v.id}
                active={variant?.id === v.id}
                onClick={() => {
                  setVariant(v);
                  setStep("when");
                }}
              >
                {v.name}
              </Chip>
            ))}
          </div>
        </Section>
      )}

      {step === "when" && (
        <Section label={t("assistant.booking.when")}>
          <input
            type="datetime-local"
            value={when}
            onChange={(e) => setWhen(e.target.value)}
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-xs"
          />
          <Next
            label={t("assistant.booking.next")}
            disabled={!when}
            onClick={() => setStep(afterWhen())}
          />
        </Section>
      )}

      {step === "duration" && (
        <Section
          label={
            perMinute
              ? t("assistant.booking.howLong")
              : perDay
              ? t("assistant.booking.howManyDays")
              : t("assistant.booking.howManyHours")
          }
        >
          <div className="flex flex-wrap gap-1">
            {durations.map((n) => (
              <Chip key={n} active={units === n} onClick={() => setUnits(n)}>
                {unitLabel(n)}
              </Chip>
            ))}
          </div>
          <Next
            label={t("assistant.booking.next")}
            onClick={() => setStep("where")}
          />
        </Section>
      )}

      {step === "session" && (
        <Section label={t("assistant.booking.session")}>
          <div className="flex flex-wrap gap-1">
            {(["one_time", "one_night"] as SessionKind[]).map((kind) => (
              <Chip
                key={kind}
                active={sessionType === kind}
                onClick={() => setSessionType(kind)}
              >
                {kind === "one_night"
                  ? t("assistant.booking.oneNight")
                  : t("assistant.booking.oneTime")}
              </Chip>
            ))}
          </div>
          <Next
            label={t("assistant.booking.next")}
            onClick={() => setStep("where")}
          />
        </Section>
      )}

      {step === "where" && (
        <Section label={t("assistant.booking.where")}>
          <div className="flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-2">
            <MapPin className="h-3 w-3 shrink-0 text-gray-400" />
            <input
              value={where}
              onChange={(e) => setWhere(e.target.value)}
              placeholder={t("assistant.booking.wherePlaceholder")}
              className="w-full py-2 text-xs outline-none"
            />
          </div>
          <Next
            label={t("assistant.booking.next")}
            disabled={!where.trim()}
            onClick={askForPrice}
          />
        </Section>
      )}

      {step === "confirm" && (
        <Section label={t("assistant.booking.confirm")}>
          {pricing.state !== "idle" && <Spinner />}
          {pricing.data?.error && (
            <p className="text-xs text-red-600">{pricing.data.error}</p>
          )}

          {price != null && (
            <div className="space-y-1 rounded-lg bg-white p-2 text-xs text-gray-700">
              <Row
                label={t("assistant.booking.labelService")}
                value={service?.name ?? ""}
              />
              {variant && (
                <Row
                  label={t("assistant.booking.labelKind")}
                  value={variant.name}
                />
              )}
              <Row
                label={t("assistant.booking.labelWhen")}
                value={when ? new Date(when).toLocaleString() : ""}
              />
              {perSession ? (
                <Row
                  label={t("assistant.booking.labelSession")}
                  value={
                    sessionType === "one_night"
                      ? t("assistant.booking.oneNight")
                      : t("assistant.booking.oneTime")
                  }
                />
              ) : (
                <Row
                  label={t("assistant.booking.labelDuration")}
                  value={unitLabel(units)}
                />
              )}
              <Row label={t("assistant.booking.labelWhere")} value={where} />
              <Row
                label={t("assistant.booking.labelTotal")}
                value={`${price.toLocaleString()} ₭`}
                bold
              />
              {funds && (
                <Row
                  label={t("assistant.booking.labelBalance")}
                  value={`${funds.available.toLocaleString()} ₭`}
                />
              )}
            </div>
          )}

          {booking.data?.error && (
            <p className="text-xs text-red-600">{booking.data.error}</p>
          )}

          {short ? (
            <div className="space-y-2">
              <p className="text-xs text-amber-700">
                {t("assistant.booking.notEnough")}
              </p>
              <button
                onClick={() =>
                  navigate(
                    `/customer/wallet-topup?returnUrl=/customer&amount=${
                      price ?? 0
                    }`
                  )
                }
                className="w-full rounded-lg bg-rose-500 py-2 text-xs font-semibold text-white"
              >
                <Wallet className="mr-1 inline h-3 w-3" />
                {t("assistant.booking.addMoney")}
              </button>
            </div>
          ) : (
            price != null && (
              <button
                onClick={confirm}
                disabled={booking.state !== "idle"}
                className="w-full rounded-lg bg-rose-500 py-2 text-xs font-semibold text-white disabled:opacity-60"
              >
                {booking.state !== "idle"
                  ? t("assistant.booking.sending")
                  : t("assistant.booking.confirmBooking")}
              </button>
            )
          )}
        </Section>
      )}

      <button
        onClick={onCancel}
        className="mt-2 text-[11px] text-gray-500 underline"
      >
        {t("assistant.booking.cancel")}
      </button>
    </div>
  );
}

function Section({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <p className="flex items-center gap-1 text-[11px] font-medium text-gray-600">
        <CalendarDays className="h-3 w-3" />
        {label}
      </p>
      {children}
    </div>
  );
}

function Chip({
  children,
  onClick,
  active,
}: {
  children: React.ReactNode;
  onClick: () => void;
  active?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full border px-2 py-1 text-[11px] ${
        active
          ? "border-rose-500 bg-rose-500 text-white"
          : "border-gray-200 bg-white text-gray-700 hover:border-rose-300"
      }`}
    >
      {children}
    </button>
  );
}

function Next({
  onClick,
  disabled,
  label,
}: {
  onClick: () => void;
  disabled?: boolean;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="w-full rounded-lg bg-gray-900 py-2 text-xs font-semibold text-white disabled:opacity-40"
    >
      {label}
    </button>
  );
}

function Row({
  label,
  value,
  bold,
}: {
  label: string;
  value: string;
  bold?: boolean;
}) {
  return (
    <div className="flex justify-between gap-2">
      <span className="text-gray-500">{label}</span>
      <span className={bold ? "font-semibold text-gray-900" : "text-gray-800"}>
        {value}
      </span>
    </div>
  );
}

function Spinner() {
  return <Loader2 className="h-4 w-4 animate-spin text-rose-400" />;
}
