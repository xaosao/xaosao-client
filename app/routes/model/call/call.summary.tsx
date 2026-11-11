/**
 * What the call earned, after it has settled.
 *
 * The model sees their net: the platform's commission is already out of
 * the figure that reached their wallet, so showing the gross would be
 * misleading.
 */

import { Link, useLoaderData, type LoaderFunctionArgs } from "react-router";
import { useTranslation } from "react-i18next";
import { PhoneOff, Clock, Wallet } from "lucide-react";

import { requireModelSession } from "~/services/model-auth.server";
import { prisma } from "~/services/database.server";

export async function loader({ request, params }: LoaderFunctionArgs) {
  const modelId = await requireModelSession(request);
  const sessionId = params.sessionId as string;

  const session = await prisma.call_session.findUnique({
    where: { id: sessionId },
    include: {
      customer: { select: { firstName: true, lastName: true } },
    },
  });

  if (!session || session.modelId !== modelId) {
    throw new Response("Not found", { status: 404 });
  }

  return { session };
}

export default function ModelCallSummary() {
  const { session } = useLoaderData<typeof loader>();
  const { t } = useTranslation();

  const name =
    `${session.customer?.firstName ?? ""} ${session.customer?.lastName ?? ""}`.trim() ||
    t("call.someone", { defaultValue: "Someone" });

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

        {session.connectedAt ? (
          <dl className="mt-5 space-y-2 text-sm">
            <div className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2">
              <dt className="flex items-center gap-2 text-gray-500">
                <Clock className="h-4 w-4" />
                {t("call.duration", { defaultValue: "Duration" })}
              </dt>
              <dd className="text-gray-700">
                {session.billedMinutes}{" "}
                {t("call.minutes", { defaultValue: "min" })}
              </dd>
            </div>
            <div className="flex items-center justify-between rounded-lg bg-emerald-50 px-3 py-2">
              <dt className="flex items-center gap-2 text-emerald-700">
                <Wallet className="h-4 w-4" />
                {t("call.youEarned", { defaultValue: "You earned" })}
              </dt>
              <dd className="font-bold text-emerald-700">
                {session.modelEarning.toLocaleString()} ₭
              </dd>
            </div>
          </dl>
        ) : (
          <p className="mt-4 rounded-lg bg-gray-50 px-3 py-3 text-sm text-gray-600">
            {t("call.notConnectedModel", {
              defaultValue: "The call did not connect.",
            })}
          </p>
        )}

        <Link
          to="/model"
          className="mt-6 block w-full rounded-xl bg-rose-500 py-3 text-sm font-semibold text-white hover:bg-rose-600"
        >
          {t("common.done", { defaultValue: "Done" })}
        </Link>
      </div>
    </div>
  );
}
