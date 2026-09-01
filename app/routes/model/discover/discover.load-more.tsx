/** Resource route: the next page of the model's Discover grid. */

import type { LoaderFunctionArgs } from "react-router";
import { requireModelSession } from "~/services/model-auth.server";
import { parseTab } from "~/components/discover/DiscoverTabs";
import { loadModelDiscover } from "~/services/discover.server";

export async function loader({ request }: LoaderFunctionArgs) {
  const modelId = await requireModelSession(request);
  const url = new URL(request.url);
  const tab = parseTab(url.searchParams.get("tab"));
  const page = Math.max(1, Number(url.searchParams.get("page")) || 1);

  const { prisma } = await import("~/services/database.server");
  const me = await prisma.model.findUnique({
    where: { id: modelId },
    select: { latitude: true, longitude: true },
  });

  return loadModelDiscover(modelId, tab, page, {
    lat: me?.latitude,
    lng: me?.longitude,
  });
}
