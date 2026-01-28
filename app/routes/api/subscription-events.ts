import type { LoaderFunction } from "react-router";
import { requireUserSession } from "~/services/auths.server";
import { hasPendingSubscription } from "~/services/package.server";

// Store active SSE connections
// Map<customerId, ReadableStreamDefaultController>
const activeConnections = new Map<string, ReadableStreamDefaultController>();

// Cleanup old connections after 5 minutes
const CONNECTION_TIMEOUT = 5 * 60 * 1000; // 5 minutes
const HEARTBEAT_INTERVAL = 30 * 1000; // 30 seconds

export const loader: LoaderFunction = async ({ request }) => {
  const customerId = await requireUserSession(request);

  // Check if customer has pending subscription
  const hasPending = await hasPendingSubscription(customerId);

  if (!hasPending) {
    return new Response("No pending subscription", { status: 400 });
  }

  // Create SSE stream
  const stream = new ReadableStream({
    start(controller) {
      // Store connection
      activeConnections.set(customerId, controller);
      console.log(`[SSE] Customer ${customerId} connected. Active connections: ${activeConnections.size}`);

      // Send initial connection message
      const initialMessage = `data: ${JSON.stringify({ type: "connected", customerId })}\n\n`;
      controller.enqueue(new TextEncoder().encode(initialMessage));

      // Setup heartbeat to keep connection alive
      const heartbeatInterval = setInterval(() => {
        try {
          const heartbeat = `data: ${JSON.stringify({ type: "heartbeat" })}\n\n`;
          controller.enqueue(new TextEncoder().encode(heartbeat));
        } catch (error) {
          console.error(`[SSE] Heartbeat error for customer ${customerId}:`, error);
          clearInterval(heartbeatInterval);
          clearTimeout(timeout);
          activeConnections.delete(customerId);
        }
      }, HEARTBEAT_INTERVAL);

      // Setup connection timeout
      const timeout = setTimeout(() => {
        console.log(`[SSE] Connection timeout for customer ${customerId}`);
        clearInterval(heartbeatInterval);

        try {
          const timeoutMessage = `data: ${JSON.stringify({ type: "timeout" })}\n\n`;
          controller.enqueue(new TextEncoder().encode(timeoutMessage));
          controller.close();
        } catch (error) {
          console.error(`[SSE] Error closing connection for customer ${customerId}:`, error);
        }

        activeConnections.delete(customerId);
      }, CONNECTION_TIMEOUT);

      // Cleanup on connection close
      request.signal.addEventListener("abort", () => {
        console.log(`[SSE] Customer ${customerId} disconnected`);
        clearInterval(heartbeatInterval);
        clearTimeout(timeout);
        activeConnections.delete(customerId);
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
    },
  });
};

// Export function to send events to specific customer
export function sendSubscriptionEvent(customerId: string, data: { subscriptionId: string; status: string }) {
  const controller = activeConnections.get(customerId);

  if (!controller) {
    console.log(`[SSE] No active connection for customer ${customerId}`);
    return false;
  }

  try {
    const message = `event: subscription-activated\ndata: ${JSON.stringify(data)}\n\n`;
    controller.enqueue(new TextEncoder().encode(message));
    console.log(`[SSE] Sent subscription-activated event to customer ${customerId}`);

    // Close connection after sending activation event
    setTimeout(() => {
      try {
        controller.close();
        activeConnections.delete(customerId);
        console.log(`[SSE] Closed connection for customer ${customerId}`);
      } catch (error) {
        console.error(`[SSE] Error closing connection:`, error);
      }
    }, 1000);

    return true;
  } catch (error) {
    console.error(`[SSE] Error sending event to customer ${customerId}:`, error);
    activeConnections.delete(customerId);
    return false;
  }
}

// Export function to get active connections count (for debugging)
export function getActiveConnectionsCount(): number {
  return activeConnections.size;
}
