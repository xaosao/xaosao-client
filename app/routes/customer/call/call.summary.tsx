/**
 * What the call cost, after it has settled.
 *
 * Read straight from the call row rather than recomputed here: the
 * figures shown are the ones that moved the wallet.
 */

import { Link, useLoaderData, type LoaderFunctionArgs } from "react-router";
import { useTranslation } from "react-i18next";
import { PhoneOff, Clock, Wallet, RotateCcw } from "lucide-react";

import { requireUserSession } from "~/services/auths.server";
import { prisma } from "~/services/database.server";

export async function loader({ request, params }: LoaderFunctionArgs) {
  const customerId = await requireUserSession(request);
  const sessionId = params.sessionId as string;

  const session = await prisma.call_session.findUnique({
    where: { id: sessionId },
    include: {
      model: { select: { firstName: true, lastName: true, profile: true } },
    },
  });

  if (!session || session.customerId !== customerId) {
    throw new Response("Not found", { status: 404 });
  }

  return { session };
}

export default function CustomerCallSummary() {
  const { session } = useLoaderData<typeof loader>();
  const { t } = useTranslation();

  const name =
    `${session.model?.firstName ?? ""} ${session.model?.lastName ?? ""}`.trim() ||
    "Model";

  const neverConnected = !session.connectedAt;

  return (
    <div className="mx-auto max-w-md px-4 py-10">
      <div className="rounded-2xl border border-gray-100 bg-white p-6 text-center shadow-sm">
        <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-gray-100">
          <PhoneOff className="h-6 w-6 text-gray-400" />
        </div>

        <h1 className="text-lg font-bold text-gray-900">
          {t("call.ended", { defaultValue: "Call ended" })}
        </h1>
        <p className="mt-1 text-sm text-gray-500">{name}</p>

        {neverConnected ? (
          <p className="mt-4 rounded-lg bg-gray-50 px-3 py-3 text-sm text-gray-600">
            {reasonText(session.endReason, t)}
          </p>
        ) : (
          <dl className="mt-5 space-y-2 text-sm">
            <Row
              icon={<Clock className="h-4 w-4" />}
              label={t("call.duration", { defaultValue: "Duration" })}
              value={`${session.billedMinutes} ${t("call.minutes", { defaultValue: "min" })}`}
            />
            <Row
              icon={<Wallet className="h-4 w-4" />}
              label={t("call.charged", { defaultValue: "Charged" })}
              value={`${session.billedAmount.toLocaleString()} ₭`}
              strong
            />
            {session.refundedAmount > 0 && (
              <Row
                icon={<RotateCcw className="h-4 w-4" />}
                label={t("call.returned", { defaultValue: "Returned to wallet" })}
                value={`${session.refundedAmount.toLocaleString()} ₭`}
              />
            )}
          </dl>
        )}

        {/* Nobody picked up, and nothing was charged — the useful next
            step is another model, not a dead end on "Done". A connected
            call ends on Done, because the customer got what they came
            for. */}
        {neverConnected ? (
          <div className="mt-6 space-y-2">
            {/* Discover is the customer INDEX route, so it is at
                /customer. /customer/discover does not exist. */}
            <Link
              to="/customer"
              className="block w-full rounded-xl bg-rose-500 py-3 text-sm font-semibold text-white hover:bg-rose-600"
            >
              {t("call.findSomeoneElse", {
                defaultValue: "Find someone else",
              })}
            </Link>
            <Link
              to="/customer"
              className="block w-full rounded-xl border border-gray-200 py-3 text-sm font-semibold text-gray-600 hover:bg-gray-50"
            >
              {t("common.done", { defaultValue: "Done" })}
            </Link>
          </div>
        ) : (
          <Link
            to="/customer"
            className="mt-6 block w-full rounded-xl bg-rose-500 py-3 text-sm font-semibold text-white hover:bg-rose-600"
          >
            {t("common.done", { defaultValue: "Done" })}
          </Link>
        )}
      </div>
    </div>
  );
}

function Row({
  icon,
  label,
  value,
  strong,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2">
      <dt className="flex items-center gap-2 text-gray-500">
        {icon}
        {label}
      </dt>
      <dd className={strong ? "font-bold text-gray-900" : "text-gray-700"}>
        {value}
      </dd>
    </div>
  );
}

function reasonText(
  reason: string | null,
  t: (key: string, options: Record<string, unknown>) => string,
) {
  switch (reason) {
    case "missed":
      return t("call.noAnswer", {
        defaultValue: "No answer. Nothing was charged.",
      });
    case "declined":
      return t("call.declined", {
        defaultValue: "The call was declined. Nothing was charged.",
      });
    case "cancelled":
      return t("call.cancelled", {
        defaultValue: "You cancelled the call. Nothing was charged.",
      });
    default:
      return t("call.notConnected", {
        defaultValue: "The call did not connect. Nothing was charged.",
      });
  }
}
