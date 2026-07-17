/**
 * In-process TTL cache with LRU eviction.
 *
 * Purpose: kill the "click into a model → click back → wait 3 seconds"
 * pattern that dominates customer discover/matches perceived latency.
 * React Router re-runs every loader when the pathname changes, so back
 * navigation always paid the full DB cost. Wrapping the heavy queries
 * with a 30-60 s cache turns the second load into a memory read.
 *
 * Safe here because each entry keys on `(fn, customerId, filters)` and
 * we invalidate on the actions that would change what a customer sees
 * (like/pass/addFriend/subscription events).
 */

interface Entry<T> {
  value: T;
  expiresAt: number;
}

const MAX_ENTRIES = 500;
const store = new Map<string, Entry<unknown>>();

function evictIfNeeded() {
  if (store.size <= MAX_ENTRIES) return;
  // Map preserves insertion order — deleting the first key is LRU-approx.
  // Anything read via cacheGet gets re-inserted (see below), so hot keys
  // survive.
  const oldest = store.keys().next().value;
  if (oldest !== undefined) store.delete(oldest);
}

export function cacheGet<T>(key: string): T | undefined {
  const entry = store.get(key) as Entry<T> | undefined;
  if (!entry) return undefined;
  if (entry.expiresAt < Date.now()) {
    store.delete(key);
    return undefined;
  }
  // Refresh recency for LRU
  store.delete(key);
  store.set(key, entry);
  return entry.value;
}

export function cacheSet<T>(key: string, value: T, ttlMs: number): void {
  store.set(key, { value, expiresAt: Date.now() + ttlMs });
  evictIfNeeded();
}

/**
 * Cache-through wrapper. Call the fetcher only if the key is missing
 * or expired; otherwise return the cached value.
 */
export async function withCache<T>(
  key: string,
  ttlMs: number,
  fetcher: () => Promise<T>
): Promise<T> {
  const hit = cacheGet<T>(key);
  if (hit !== undefined) return hit;
  const value = await fetcher();
  cacheSet(key, value, ttlMs);
  return value;
}

/**
 * Drop every cache entry whose key contains this substring.
 * Called by action handlers (like/pass/addFriend) so the customer's
 * next loader run sees fresh data instead of the pre-action snapshot.
 */
export function cacheInvalidateContaining(substring: string): void {
  if (!substring) return;
  for (const key of store.keys()) {
    if (key.includes(substring)) store.delete(key);
  }
}

/** Stable JSON.stringify for filter objects — order-independent. */
export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return "[" + value.map(stableStringify).join(",") + "]";
  const keys = Object.keys(value as object).sort();
  return (
    "{" +
    keys
      .map((k) => JSON.stringify(k) + ":" + stableStringify((value as any)[k]))
      .join(",") +
    "}"
  );
}
