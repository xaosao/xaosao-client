import cron from "node-cron";
import { expireOldPosts } from "./post.server";

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

  console.log("[Scheduler] Cron jobs initialized.");
}

// Auto-initialize on import (server-side only)
initScheduler();
