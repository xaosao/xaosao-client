import type { LoaderFunction } from "react-router";
import { getUserFromSession } from "~/services/auths.server";
import {
  notificationEmitter,
  getCustomerChannel,
} from "~/services/notification.server";

export const loader: LoaderFunction = async ({ request }) => {
  const customerId = await getUserFromSession(request);

  if (!customerId) {
    return new Response("Unauthorized", { status: 401 });
  }

  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();
      const channel = getCustomerChannel(customerId);

      // Send initial connection message
      controller.enqueue(
        encoder.encode(`data: ${JSON.stringify({ type: "connected" })}\n\n`)
      );

      // Handler for new notifications
      const handler = (notification: any) => {
        try {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(notification)}\n\n`)
          );
        } catch (error) {
          // Stream might be closed
          console.error("SSE write error:", error);
        }
      };

      // Subscribe to customer channel
      notificationEmitter.on(channel, handler);

      // Keep connection alive with heartbeat
      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: "heartbeat" })}\n\n`)
          );
        } catch {
          clearInterval(heartbeat);
        }
      }, 30000);

      // Cleanup on close
      request.signal.addEventListener("abort", () => {
        notificationEmitter.off(channel, handler);
        clearInterval(heartbeat);
        try {
          controller.close();
        } catch {
          // Already closed
        }
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
};
