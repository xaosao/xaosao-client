/**
 * Production server for xaosao-client.
 *
 * Replaces `react-router-serve` so we can:
 *   - Handle SIGTERM gracefully (finish in-flight requests, close SSE
 *     streams, disconnect Prisma) — without this, every deploy served
 *     mid-request errors to whoever was mid-navigation.
 *   - Gzip the loader/document responses. RR .data responses are often
 *     several hundred KB; compression drops that ~10×.
 *   - Serve static assets efficiently with long cache headers.
 *   - Bind explicitly to 0.0.0.0 so Docker networking works.
 *
 * Run: `node server.js`. PORT/HOST via env, default 3000/0.0.0.0.
 */

import { createRequestHandler } from "@react-router/express";
import compression from "compression";
import express from "express";
import morgan from "morgan";

const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || "0.0.0.0";
const NODE_ENV = process.env.NODE_ENV || "production";

const app = express();

app.disable("x-powered-by");
app.set("trust proxy", true); // Behind nginx — needed for req.ip and req.protocol

// Do NOT compress SSE endpoints — compression buffers, killing event flush.
app.use(
  compression({
    filter: (req, res) => {
      if (req.path.includes("/api/notifications/") && req.path.endsWith("-sse")) return false;
      if (req.path.startsWith("/api/subscription-events")) return false;
      return compression.filter(req, res);
    },
  })
);

// Hashed build assets: safe to cache forever
app.use(
  "/assets",
  express.static("build/client/assets", {
    immutable: true,
    maxAge: "1y",
  })
);

// Everything else in /build/client (favicon, robots.txt, etc.) — short cache
app.use(express.static("build/client", { maxAge: "1h" }));

// Public dir (uploaded/static content)
app.use(express.static("public", { maxAge: "1h" }));

// Access log — 'combined' matches nginx format; tune down for high traffic
if (NODE_ENV !== "test") {
  app.use(
    morgan("combined", {
      skip: (req) => req.url === "/healthz", // don't spam logs with healthchecks
    })
  );
}

// Hand off everything else to the React Router build
const build = await import("./build/server/index.js");
app.all(
  "*",
  createRequestHandler({
    build,
    mode: NODE_ENV,
  })
);

const server = app.listen(PORT, HOST, () => {
  console.log(`[server] listening on http://${HOST}:${PORT} (${NODE_ENV})`);
});

// ─── Graceful shutdown ──────────────────────────────────────────────────────
// Docker sends SIGTERM on `docker stop`, `docker compose down`, and during
// rolling restarts. Without this, any in-flight request (SSE stream, slow
// loader, big upload) is terminated mid-flight and the user sees a 502.

let shuttingDown = false;

async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`[shutdown] Received ${signal}, closing gracefully`);

  // Stop accepting new connections; existing ones drain naturally.
  // Prisma's connection pool is cleaned up on process exit — no need to
  // reach into the RR build to disconnect it explicitly.
  server.close((err) => {
    if (err) console.error("[shutdown] server.close error:", err);
    console.log("[shutdown] closed cleanly");
    process.exit(0);
  });

  // Hard cap — if in-flight requests don't finish in 25s, force exit.
  // Must be < Docker's stop_grace_period (we set 30s below).
  setTimeout(() => {
    console.error("[shutdown] timeout — forcing exit");
    process.exit(1);
  }, 25_000).unref();
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

// Surface unhandled rejections instead of silently ignoring them.
process.on("unhandledRejection", (reason) => {
  console.error("[unhandledRejection]", reason);
});
process.on("uncaughtException", (err) => {
  console.error("[uncaughtException]", err);
});
