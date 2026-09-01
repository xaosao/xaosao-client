/**
 * Resource route: the next page of the customer's Discover grid.
 *
 * Shares `loadCustomerDiscover` with the page loader so page 1 and page N
 * always come from the same query — otherwise the grid duplicates or skips
 * rows as you scroll.
 */

import type { LoaderFunctionArgs } from "react-router";
import { requireVerifiedUserSession } from "~/services/auths.server";
import { parseTab } from "~/components/discover/DiscoverTabs";
import { loadCustomerDiscover } from "~/services/discover.server";

export async function loader({ request }: LoaderFunctionArgs) {
  const customerId = await requireVerifiedUserSession(request);
  const url = new URL(request.url);
  const tab = parseTab(url.searchParams.get("tab"));
  const page = Math.max(1, Number(url.searchParams.get("page")) || 1);

  const { prisma } = await import("~/services/database.server");
  const me = await prisma.customer.findUnique({
    where: { id: customerId },
    select: { latitude: true, longitude: true },
  });

  return loadCustomerDiscover(
    customerId,
    tab,
    page,
    !!(me?.latitude && me?.longitude)
  );
}
