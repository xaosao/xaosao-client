import type { EntryContext } from "react-router";
import { ServerRouter } from "react-router";
import { isbot } from "isbot";
import { renderToReadableStream } from "react-dom/server";

export default async function handleRequest(
  request: Request,
  responseStatusCode: number,
  responseHeaders: Headers,
  routerContext: EntryContext
) {
  const url = new URL(request.url);

  // Add cache control headers to prevent iOS Safari caching issues
  // For HTML pages - prevent caching
  if (
    request.headers.get("Accept")?.includes("text/html") ||
    url.pathname === "/" ||
    !url.pathname.includes(".")
  ) {
    responseHeaders.set("Cache-Control", "no-cache, no-store, must-revalidate, max-age=0");
    responseHeaders.set("Pragma", "no-cache");
    responseHeaders.set("Expires", "0");
  }

  // For service worker - never cache
  if (url.pathname === "/sw.js") {
    responseHeaders.set("Cache-Control", "no-cache, no-store, must-revalidate, max-age=0");
    responseHeaders.set("Service-Worker-Allowed", "/");
  }

  // For images in /images/ folder - no cache to prevent stale content
  if (url.pathname.startsWith("/images/")) {
    responseHeaders.set("Cache-Control", "no-cache, must-revalidate, max-age=0");
  }

  const body = await renderToReadableStream(
    <ServerRouter context={routerContext} url={request.url} />,
    {
      signal: request.signal,
      onError(error: unknown) {
        console.error(error);
        responseStatusCode = 500;
      },
    }
  );

  if (isbot(request.headers.get("user-agent") || "")) {
    await body.allReady;
  }

  responseHeaders.set("Content-Type", "text/html");

  return new Response(body, {
    headers: responseHeaders,
    status: responseStatusCode,
  });
}
