/**
 * Resource route: customer-side people search (name or WhatsApp number).
 *
 * Separate from the existing `discover.search` route, which the old page used
 * and returns a different shape — this one returns the trimmed rows the
 * header dropdown renders.
 */

import type { LoaderFunctionArgs } from "react-router";
import { requireUserSession } from "~/services/auths.server";
import { searchModels } from "~/services/model.server";

export async function loader({ request }: LoaderFunctionArgs) {
  const customerId = await requireUserSession(request);
  const query = (new URL(request.url).searchParams.get("q") || "").trim();

  if (query.length < 2) return { results: [] };

  try {
    const models = await searchModels(customerId, query);
    return {
      results: (models ?? []).map((m: any) => ({
        id: m.id,
        firstName: m.firstName,
        lastName: m.lastName,
        profile: m.profile,
        distance: typeof m.distance === "number" ? m.distance : null,
      })),
    };
  } catch (error) {
    console.error("[customer/discover/search-results]", (error as Error)?.message);
    return { results: [] };
  }
}
