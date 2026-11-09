/**
 * "Find me someone" assistant — website side.
 *
 * The understanding and the matching both live in xs_backend, so the
 * website and the app ask the same questions and get the same people.
 * This is only a typed wrapper around that endpoint.
 */

import { unwrapEnvelope, xsRequest, XsApiError } from "./xs-api.server";

export interface AssistantMatch {
  id: string;
  name: string;
  profile: string | null;
  age: number | null;
  rating: number;
  address: string | null;
  fromPrice: number | null;
  /** Straight-line km from the asking customer; null when unknown. */
  distanceKm: number | null;
}

export interface AssistantTurn {
  role: "user" | "assistant";
  text: string;
}

export interface AssistantHistoryMessage {
  role: "user" | "assistant" | "admin";
  text: string;
  matches: AssistantMatch[] | null;
  createdAt: string;
}

export interface AssistantReply {
  reply: string;
  intent: "search" | "clarify" | "chitchat";
  matches: AssistantMatch[];
}

/**
 * The customer's saved thread, including anything an admin picked for
 * them by hand. Reading it clears the unread badge server-side.
 */
export async function getAssistantHistory(
  customerId: string
): Promise<AssistantHistoryMessage[]> {
  try {
    const response = await xsRequest("assistant/history", {
      userId: customerId,
      userType: "customer",
    });
    return (
      unwrapEnvelope<{ messages: AssistantHistoryMessage[] }>(response)
        ?.messages ?? []
    );
  } catch (error) {
    // An empty thread is a fine fallback — the sheet simply opens on the
    // greeting instead of past turns.
    console.error(
      "[assistant] history failed:",
      error instanceof XsApiError ? error.message : error
    );
    return [];
  }
}

/**
 * Ask the assistant. Never throws — a failed reply becomes a sentence the
 * customer can act on rather than a broken sheet.
 */
export async function askAssistant(
  customerId: string,
  message: string,
  history: AssistantTurn[]
): Promise<AssistantReply> {
  try {
    const response = await xsRequest("assistant/ask", {
      userId: customerId,
      userType: "customer",
      method: "POST",
      body: { message, history: history.slice(-6) },
    });
    return (
      unwrapEnvelope<AssistantReply>(response) ?? {
        reply: "Sorry, I could not answer that. Please try again.",
        intent: "chitchat",
        matches: [],
      }
    );
  } catch (error) {
    console.error(
      "[assistant] ask failed:",
      error instanceof XsApiError ? error.message : error
    );
    return {
      reply:
        "The assistant is unavailable right now. You can still browse on the discover page.",
      intent: "chitchat",
      matches: [],
    };
  }
}
