/**
 * Resource route: model-side people search (name or WhatsApp number).
 * Fetched by the header search dropdown.
 */

import type { LoaderFunctionArgs } from "react-router";
import { requireModelSession } from "~/services/model-auth.server";
import { searchCustomers } from "~/services/model.server";

export async function loader({ request }: LoaderFunctionArgs) {
  const modelId = await requireModelSession(request);
  const query = (new URL(request.url).searchParams.get("q") || "").trim();

  // Two characters is the floor — a single letter matches most of the table.
  if (query.length < 2) return { results: [] };

  try {
    const customers = await searchCustomers(modelId, query);
    return {
      results: customers.map((c) => ({
        id: c.id,
        firstName: c.firstName,
        lastName: c.lastName,
        profile: c.profile,
        distance: c.distance,
      })),
    };
  } catch (error) {
    console.error("[model/discover/search]", (error as Error)?.message);
    return { results: [] };
  }
}
