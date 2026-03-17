import cron from "node-cron";
import { expireOldPosts } from "./post.server";
import { expireOverdueSubscriptions } from "./package.server";

let initialized = false;

export function initScheduler() {
  if (initialized) return;
  initialized = true;

  console.log("[Scheduler] Initializing cron jobs...");

  // Expire old posts every hour
  cron.schedule("0 * * * *", async () => {
    try {
      const count = await expireOldPosts();
      if (count > 0) {
        console.log(`[Scheduler] Expired ${count} posts`);
      }
    } catch (err) {
      console.error("[Scheduler] Failed to expire posts:", err);
    }
  });

  // Expire overdue subscriptions every 10 minutes
  cron.schedule("*/10 * * * *", async () => {
    try {
      const count = await expireOverdueSubscriptions();
      if (count > 0) {
        console.log(`[Scheduler] Expired ${count} overdue subscriptions`);
      }
    } catch (err) {
      console.error("[Scheduler] Failed to expire subscriptions:", err);
    }
  });

  console.log("[Scheduler] Cron jobs initialized.");
}

// Auto-initialize on import (server-side only)
initScheduler();
