import type { LoaderFunctionArgs } from "react-router";
import { requireUserSession } from "~/services/auths.server";

export async function loader({ request }: LoaderFunctionArgs) {
  const customerId = await requireUserSession(request);
  const { prisma } = await import("~/services/database.server");

  const url = new URL(request.url);
  const modelId = url.searchParams.get("modelId");

  if (!modelId) {
    return { hasBooking: false };
  }

  const booking = await prisma.service_booking.findFirst({
    where: {
      customerId,
      modelId,
      status: { in: ["pending", "confirmed"] },
    },
    select: { id: true },
  });

  return { hasBooking: !!booking };
}
