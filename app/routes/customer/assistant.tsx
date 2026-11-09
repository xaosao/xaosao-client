/**
 * Everything the assistant sheet talks to, behind one resource route.
 *
 * Intents:
 *   ask      — a message to the assistant; returns a reply plus matches
 *   services — what a model can be booked for, with prices
 *   quote    — price a choice and say whether the wallet covers it
 *   book     — create the booking
 *
 * Nothing is persisted between calls. The sheet holds the conversation
 * and the half-built booking on screen and sends back what it has, which
 * is why closing it leaves nothing behind. Every value is re-validated
 * here, so a tampered draft can't book at a price it invented.
 */

import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { requireUserSession } from "~/services/auths.server";
import {
  askAssistant,
  getAssistantHistory,
  type AssistantTurn,
} from "~/services/assistant.server";
import {
  bookingEnd,
  bookingFields,
  getBookableServices,
  getFunds,
  priceChoice,
  type BookingChoice,
  type SessionKind,
} from "~/services/assistant-booking.server";

/**
 * The saved thread, so a suggestion an admin sent while the customer was
 * away is waiting for them when they open the sheet.
 */
export async function loader({ request }: LoaderFunctionArgs) {
  const customerId = await requireUserSession(request);
  return { messages: await getAssistantHistory(customerId) };
}

/**
 * Rebuild the booking choice from the form against the model's real
 * services, so a tampered or stale sheet cannot name a service this
 * model does not offer, or a variant belonging to someone else.
 */
async function readChoice(
  formData: FormData
): Promise<BookingChoice | { error: string }> {
  const modelId = (formData.get("modelId") as string) || "";
  const modelServiceId = (formData.get("modelServiceId") as string) || "";
  if (!modelId || !modelServiceId) {
    return { error: "Something is missing. Please start the booking again." };
  }

  const services = await getBookableServices(modelId);
  const service = services.find((s) => s.modelServiceId === modelServiceId);
  if (!service) return { error: "That service is no longer available." };

  const variantId = (formData.get("modelServiceVariantId") as string) || "";
  const variant = service.variants.find((v) => v.id === variantId) ?? null;

  const sessionRaw = (formData.get("sessionType") as string) || "";
  const sessionType: SessionKind =
    sessionRaw === "one_night" ? "one_night" : "one_time";

  return {
    modelServiceId: service.modelServiceId,
    billingType: service.billingType,
    units: Number(formData.get("units")) || 1,
    sessionType,
    modelServiceVariantId: variant?.id ?? null,
  };
}

export async function action({ request }: ActionFunctionArgs) {
  const customerId = await requireUserSession(request);
  const formData = await request.formData();
  const intent = (formData.get("intent") as string) || "ask";

  if (intent === "services") {
    const modelId = (formData.get("modelId") as string) || "";
    if (!modelId) return { services: [] };
    return { services: await getBookableServices(modelId) };
  }

  if (intent === "quote") {
    // Read the choice back from the model's own services rather than
    // trusting the sheet: it may be stale, and this decides a payment.
    const choice = await readChoice(formData);
    if ("error" in choice) return choice;

    const price = await priceChoice(choice);
    if (price == null) {
      return {
        error:
          "This service needs the full booking screen. Open the profile to continue.",
      };
    }

    return { price, funds: await getFunds(customerId, price) };
  }

  if (intent === "book") {
    const modelId = (formData.get("modelId") as string) || "";
    const startRaw = (formData.get("startDate") as string) || "";
    const location = ((formData.get("location") as string) || "").trim();

    if (!modelId || !startRaw || !location) {
      return { error: "Something is missing. Please start the booking again." };
    }

    const startDate = new Date(startRaw);
    if (Number.isNaN(startDate.getTime())) {
      return { error: "That date did not look right. Please pick it again." };
    }
    if (startDate.getTime() < Date.now()) {
      return { error: "Please choose a time in the future." };
    }

    const choice = await readChoice(formData);
    if ("error" in choice) return choice;

    const price = await priceChoice(choice);
    if (price == null) {
      return {
        error:
          "This service needs the full booking screen. Open the profile to continue.",
      };
    }

    // Re-checked here and not trusted from the quote step: time passes
    // between the two, and the customer may have spent in between.
    const funds = await getFunds(customerId, price);
    if (funds.short) {
      return { needsDeposit: true, price, funds };
    }

    try {
      const { createServiceBooking } = await import("~/services/booking.server");

      // Duration, session type and massage variant all map onto whichever
      // fields this billing type uses — the same ones the booking screen
      // submits, so the booking service reads what it expects.
      const booking = await createServiceBooking(
        customerId,
        modelId,
        choice.modelServiceId,
        {
          startDate,
          endDate: bookingEnd(choice, startDate),
          price,
          location,
          ...bookingFields(choice),
        } as any
      );

      return { booked: true, bookingId: (booking as any)?.id ?? null, price };
    } catch (error: any) {
      console.error("[assistant] booking failed:", error);
      // The booking service raises readable messages for the cases that
      // matter — double booking, unavailable slot — so pass them through.
      const message =
        error?.fieldErrors?.message ||
        error?.payload?.message ||
        error?.message ||
        "Could not create the booking. Please try the profile page.";
      return { error: String(message) };
    }
  }

  // Default: a message for the assistant.
  const message = ((formData.get("message") as string) || "").trim();
  if (!message) return { reply: "", intent: "chitchat" as const, matches: [] };

  let history: AssistantTurn[] = [];
  try {
    const raw = formData.get("history");
    if (typeof raw === "string" && raw) history = JSON.parse(raw);
  } catch {
    // A malformed history costs this turn its follow-up context, nothing more.
  }

  return await askAssistant(customerId, message, history);
}
