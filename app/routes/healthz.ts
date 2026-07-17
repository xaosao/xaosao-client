import { prisma } from "~/services/database.server";

// Load-balancer + Docker healthcheck endpoint.
//
// Lightweight Mongo ping so a replica that lost DB connectivity is
// dropped from the pool. Do NOT do heavy work here — nginx polls this
// every ~15s and Docker Compose polls it too; a heavy loader here
// becomes 8+ req/s of pure overhead.
export async function loader() {
  try {
    await prisma.$runCommandRaw({ ping: 1 });
    return Response.json({ status: "ok", ts: Date.now() });
  } catch (err) {
    return Response.json(
      { status: "error", error: err instanceof Error ? err.message : String(err) },
      { status: 503 }
    );
  }
}
