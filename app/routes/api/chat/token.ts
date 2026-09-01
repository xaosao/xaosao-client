/**
 * Issues the short-lived xs_backend JWT the browser needs for the socket.io
 * handshake, plus the socket origin to dial.
 *
 * REST chat calls are proxied through loaders/actions so the token stays on
 * the server, but socket.io connects straight from the browser to
 * `wss://…/chat` — that handshake needs a real token client-side. It is
 * scoped to the session's own user and expires in an hour; `useChatSocket`
 * refetches on reconnect.
 */

import type { LoaderFunctionArgs } from "react-router";
import { getUserFromSession } from "~/services/auths.server";
import { getModelFromSession } from "~/services/model-auth.server";
import { mintXsToken, BROWSER_TOKEN_TTL_SECONDS } from "~/services/xs-jwt.server";
import { xsSocketUrl } from "~/services/xs-api.server";


/**
 * The socket URL as seen BY THE BROWSER.
 *
 * `XS_SOCKET_URL` is written for the server's own point of view, typically
 * `http://localhost:3055`. That is correct for a desktop browser on the same
 * machine, but wrong for any other device: on a phone loading the dev server
 * over Wi-Fi, "localhost" is the phone itself, so the socket silently fails to
 * connect. REST keeps working (those calls are made server-side), which is why
 * the symptom is "messages appear on reload but never live".
 *
 * So when the configured host is loopback but the request arrived on a
 * different host, swap in the host the browser actually used and keep the
 * backend's port. Non-loopback configuration (a real domain) is left alone.
 */
function resolveBrowserSocketUrl(request: Request): string {
  const configured = xsSocketUrl();

  let configuredUrl: URL;
  try {
    configuredUrl = new URL(configured);
  } catch {
    return configured;
  }

  const isLoopback =
    configuredUrl.hostname === "localhost" ||
    configuredUrl.hostname === "127.0.0.1";
  if (!isLoopback) return configured;

  // Prefer the proxy-aware host, then the Host header.
  const forwardedHost = request.headers.get("x-forwarded-host");
  const rawHost = forwardedHost || request.headers.get("host") || "";
  const requestHost = rawHost.split(",")[0].trim().split(":")[0];

  if (
    !requestHost ||
    requestHost === "localhost" ||
    requestHost === "127.0.0.1"
  ) {
    return configured;
  }

  configuredUrl.hostname = requestHost;
  return configuredUrl.origin;
}

export async function loader({ request }: LoaderFunctionArgs) {
  // A browser can hold both cookies (staff testing both sides); the caller
  // says which role it wants so we don't guess wrong.
  const url = new URL(request.url);
  const requested = url.searchParams.get("userType");

  const [customerId, modelId] = await Promise.all([
    getUserFromSession(request),
    getModelFromSession(request),
  ]);

  let userId: string | null = null;
  let userType: "customer" | "model" | null = null;

  if (requested === "model" && modelId) {
    userId = modelId;
    userType = "model";
  } else if (requested === "customer" && customerId) {
    userId = customerId;
    userType = "customer";
  } else if (!requested) {
    if (customerId) {
      userId = customerId;
      userType = "customer";
    } else if (modelId) {
      userId = modelId;
      userType = "model";
    }
  }

  if (!userId || !userType) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { token, expiresAt } = mintXsToken(
      userId,
      userType,
      BROWSER_TOKEN_TTL_SECONDS
    );

    return Response.json(
      {
        token,
        userId,
        userType,
        socketUrl: resolveBrowserSocketUrl(request),
        expiresAt,
      },
      // Never let a proxy or the browser cache a bearer token.
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    console.error("[api/chat/token]", error);
    return Response.json(
      { error: "Chat is not configured on this server" },
      { status: 503 }
    );
  }
}
