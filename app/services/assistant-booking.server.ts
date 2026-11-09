/**
 * In-chat booking: the assistant collects the details itself instead of
 * handing the customer off to the booking screen.
 *
 * The structured parts — which service, which massage variant, how long,
 * one-time or overnight — are collected as tappable options rather than
 * free text. They resolve to exact ids and enums, and this is money: a
 * date mis-parsed from Lao prose would book the wrong day and take a real
 * payment for it. The conversational part is the wrapper; the inputs stay
 * typed.
 *
 * Pricing and creation both go through the booking screen's own code —
 * `calculateAndVerifyBookingPrice` and `createServiceBooking` — so the
 * number quoted in the chat is the number charged, and overlap checks,
 * wallet holds and audit logs behave identically wherever the booking
 * started. The chat deliberately computes no prices of its own: the model
 * may have a custom rate or a per-variant rate, and a second formula here
 * would quote one price and charge another.
 */

import { prisma } from "./database.server";
import { calculateAndVerifyBookingPrice } from "./booking.server";

export type SessionKind = "one_time" | "one_night";

export interface BookableVariant {
  id: string;
  name: string;
  pricePerHour: number | null;
}

export interface BookableService {
  modelServiceId: string;
  name: string;
  /** "per_hour" | "per_minute" | "per_session" | "per_day" | null */
  billingType: string | null;
  /** Massage sells per variant; empty for every other service. */
  variants: BookableVariant[];
}

export interface CustomerFunds {
  available: number;
  /** True when the customer cannot cover `needed`. */
  short: boolean;
  needed: number;
}

/** What the chat needs to price and submit a booking. */
export interface BookingChoice {
  modelServiceId: string;
  billingType: string | null;
  /** per_hour / per_minute / per_day amount; ignored by per_session. */
  units: number;
  sessionType?: SessionKind;
  modelServiceVariantId?: string | null;
}

/** What this model can actually be booked for, including massage variants. */
export async function getBookableServices(
  modelId: string
): Promise<BookableService[]> {
  const rows = await prisma.model_service.findMany({
    where: { modelId, status: "active" },
    include: {
      service: { select: { name: true, billingType: true, status: true } },
      model_service_variant: {
        select: { id: true, name: true, pricePerHour: true },
      },
    },
  });

  return rows
    .filter((r) => r.service && r.service.status === "active")
    .map((r) => ({
      modelServiceId: r.id,
      name: r.service!.name,
      billingType: r.service!.billingType ?? null,
      variants: (r.model_service_variant ?? []).map((v) => ({
        id: v.id,
        name: v.name,
        pricePerHour: v.pricePerHour ?? null,
      })),
    }));
}

/**
 * Turn a chat choice into the fields a booking is made of.
 *
 * One place decides what `units` means for each billing type, so the
 * quote step and the booking step can never disagree about it.
 */
export function bookingFields(choice: BookingChoice) {
  const n = Math.max(1, Math.floor(choice.units || 1));

  switch (choice.billingType) {
    case "per_hour":
      return {
        hours: n,
        modelServiceVariantId: choice.modelServiceVariantId || null,
      };
    case "per_minute":
      return { minutes: n };
    case "per_day":
      return { dayAmount: n };
    case "per_session":
      return { sessionType: choice.sessionType ?? ("one_time" as SessionKind) };
    default:
      return {};
  }
}

/**
 * End of the booking, matching what the booking screen submits: only
 * per_day carries an explicit end, because only per_day asks for one.
 */
export function bookingEnd(choice: BookingChoice, start: Date): Date | undefined {
  if (choice.billingType !== "per_day") return undefined;
  const days = Math.max(1, Math.floor(choice.units || 1));
  return new Date(start.getTime() + days * 24 * 3600_000);
}

/**
 * The price, straight from the booking engine.
 *
 * `calculateAndVerifyBookingPrice` is handed 0 as the "frontend price"
 * because there is no customer-supplied figure to check at this point —
 * the chat is asking what the booking costs, not proposing a number.
 * Returns null when the service has no rate configured for its billing
 * type: better to send the customer to the full booking screen than to
 * quote something invented.
 */
export async function priceChoice(
  choice: BookingChoice
): Promise<number | null> {
  const verification = await calculateAndVerifyBookingPrice(
    choice.modelServiceId,
    0,
    bookingFields(choice) as any
  );
  const price = verification.calculatedPrice;
  return price > 0 ? price : null;
}

/**
 * Spendable balance, and whether it covers `needed`.
 *
 * Mirrors the wallet's own formula: what a customer can spend is what
 * they topped up, less what they have spent, plus refunds.
 */
export async function getFunds(
  customerId: string,
  needed: number
): Promise<CustomerFunds> {
  const wallet = await prisma.wallet.findFirst({
    where: { customerId },
    select: { totalBalance: true, totalSpend: true, totalRefunded: true },
  });

  const available =
    (wallet?.totalBalance ?? 0) -
    (wallet?.totalSpend ?? 0) +
    (wallet?.totalRefunded ?? 0);

  return { available, short: available < needed, needed };
}
