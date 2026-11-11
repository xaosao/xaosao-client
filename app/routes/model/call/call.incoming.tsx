/**
 * The ringing screen on the model's side.
 *
 * Reached from the push notification or the socket event, both of which
 * carry the session id. Answering swaps this screen for the call itself;
 * declining releases the customer's hold immediately.
 */

import { useEffect, useRef } from "react";
import {
  redirect,
  useFetcher,
  useLoaderData,
  useNavigate,
  type LoaderFunctionArgs,
} from "react-router";
import { useTranslation } from "react-i18next";
import { Phone, PhoneOff, User, Video } from "lucide-react";

import { requireModelSession } from "~/services/model-auth.server";
import { getCallState } from "~/services/call.server";
import { prisma } from "~/services/database.server";

export async function loader({ request, params }: LoaderFunctionArgs) {
  const modelId = await requireModelSession(request);
  const sessionId = params.sessionId as string;

  const session = await prisma.call_session.findUnique({
    where: { id: sessionId },
    include: {
      customer: { select: { firstName: true, lastName: true, profile: true } },
    },
  });

  if (!session || session.modelId !== modelId) {
    throw new Response("Not found", { status: 404 });
  }

  // A call that stopped ringing while the page was loading: don't show a
  // phone that cannot be answered.
  if (session.status === "ended") {
    return redirect(`/model/call/summary/${sessionId}`);
  }
  if (session.status !== "ringing") {
    return redirect(`/model/call/active/${sessionId}`);
  }

  const state = await getCallState(
    { userId: modelId as string, userType: "model" },
    sessionId
  );

  return { session, state };
}

export default function IncomingCall() {
  const { session } = useLoaderData<typeof loader>();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const answer = useFetcher<{ ok?: boolean; error?: string }>();
  const decline = useFetcher<{ ok?: boolean }>();
  const poll = useFetcher<{ state: { status: string } | null }>();
  const handled = useRef(false);

  const name =
    `${session.customer?.firstName ?? ""} ${session.customer?.lastName ?? ""}`.trim() ||
    t("call.someone", { defaultValue: "Someone" });

  // The caller may give up, or the ring may time out, while this screen
  // is open — the server decides, so ask it.
  useEffect(() => {
    const id = setInterval(() => {
      if (handled.current) return;
      poll.load(`/api/call/session?sessionId=${session.id}`);
    }, 3000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.id]);

  useEffect(() => {
    if (poll.data?.state?.status === "ended" && !handled.current) {
      handled.current = true;
      navigate("/model", { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [poll.data]);

  useEffect(() => {
    const data = answer.data as any;
    if (data && data.ok !== false && !handled.current) {
      handled.current = true;
      navigate(`/model/call/active/${session.id}`, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [answer.data]);

  useEffect(() => {
    if (decline.data && !handled.current) {
      handled.current = true;
      navigate("/model", { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [decline.data]);

  function act(fetcher: typeof answer, intent: "answer" | "decline") {
    const form = new FormData();
    form.set("intent", intent);
    form.set("sessionId", session.id);
    fetcher.submit(form, { method: "post", action: "/api/call/session" });
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-between bg-gray-900 px-6 py-16 text-white">
      <div className="flex flex-1 flex-col items-center justify-center gap-4">
        {session.customer?.profile ? (
          <img
            src={session.customer.profile}
            alt={name}
            className="h-32 w-32 animate-pulse rounded-full object-cover ring-4 ring-white/10"
          />
        ) : (
          <div className="flex h-32 w-32 animate-pulse items-center justify-center rounded-full bg-white/10">
            <User className="h-14 w-14 text-white/60" />
          </div>
        )}

        <p className="text-2xl font-semibold">{name}</p>
        <p className="flex items-center gap-1 text-sm text-white/60">
          {session.callType === "video" ? (
            <Video className="h-4 w-4" />
          ) : (
            <Phone className="h-4 w-4" />
          )}
          {t("call.incoming", { defaultValue: "Incoming call" })}
        </p>

        <p className="rounded-full bg-emerald-500/15 px-3 py-1 text-xs text-emerald-300">
          {t("call.youEarn", {
            defaultValue: "You earn {{amount}} ₭ per minute",
            amount: Math.round(
              session.ratePerMinute * (1 - session.commissionRate / 100)
            ).toLocaleString(),
          })}
        </p>

        {(answer.data as any)?.error && (
          <p className="text-xs text-red-300">{(answer.data as any).error}</p>
        )}
      </div>

      <div className="flex w-full items-center justify-around">
        <button
          onClick={() => act(decline as any, "decline")}
          disabled={decline.state !== "idle"}
          className="flex flex-col items-center gap-2"
        >
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-rose-500">
            <PhoneOff className="h-7 w-7" />
          </span>
          <span className="text-xs text-white/60">
            {t("call.decline", { defaultValue: "Decline" })}
          </span>
        </button>

        <button
          onClick={() => act(answer, "answer")}
          disabled={answer.state !== "idle"}
          className="flex flex-col items-center gap-2"
        >
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500">
            <Phone className="h-7 w-7" />
          </span>
          <span className="text-xs text-white/60">
            {t("call.answer", { defaultValue: "Answer" })}
          </span>
        </button>
      </div>
    </div>
  );
}
