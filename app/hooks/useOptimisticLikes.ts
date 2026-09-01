/**
 * Keeps heart buttons steady across the whole request lifecycle.
 *
 * Rendering straight from loader data makes the heart flicker back: while the
 * fetcher is in flight you can read the submitted value, but the moment it
 * completes `fetcher.formData` becomes undefined and the card falls back to
 * loader data — which is only correct once revalidation has landed. In between
 * the heart snaps to the old state and then forward again.
 *
 * So three layers, most-recent first:
 *   1. the in-flight submission (instant feedback)
 *   2. the server's confirmed answer, held until the loader agrees
 *   3. loader data
 *
 * Overrides are dropped as soon as loader data matches them, so this can't
 * drift away from the server.
 */

import { useEffect, useMemo, useState } from "react";
import type { FetcherWithComponents } from "react-router";

interface LikeableProfile {
  id: string;
  liked?: boolean;
}

interface LikeActionResult {
  success?: boolean;
  liked?: boolean;
  /** Whichever id field the route's action echoes back. */
  modelId?: string;
  customerId?: string;
}

export function useOptimisticLikes<T extends LikeableProfile>(
  profiles: T[],
  fetcher: FetcherWithComponents<LikeActionResult>,
  /** Form field carrying the id — "modelId" (customer side) or "customerId". */
  idField: "modelId" | "customerId"
): T[] {
  const [overrides, setOverrides] = useState<Record<string, boolean>>({});

  const pendingId = (fetcher.formData?.get(idField) as string | null) ?? null;
  const pendingLiked = fetcher.formData?.get("liked") === "true";

  // Hold the server's answer until the loader reflects it.
  useEffect(() => {
    if (fetcher.state !== "idle" || !fetcher.data) return;
    const { success, liked, modelId, customerId } = fetcher.data;
    const id = modelId ?? customerId;
    if (!id || typeof liked !== "boolean") return;
    // On failure `liked` comes back as the ORIGINAL value, so this also
    // rolls the heart back when the write didn't happen.
    if (success === false) {
      setOverrides((current) => ({ ...current, [id]: liked }));
      return;
    }
    setOverrides((current) => ({ ...current, [id]: liked }));
  }, [fetcher.state, fetcher.data]);

  // Retire overrides the loader has caught up with.
  useEffect(() => {
    setOverrides((current) => {
      let changed = false;
      const next = { ...current };
      for (const profile of profiles) {
        if (profile.id in next && next[profile.id] === !!profile.liked) {
          delete next[profile.id];
          changed = true;
        }
      }
      return changed ? next : current;
    });
  }, [profiles]);

  return useMemo(
    () =>
      profiles.map((profile) => {
        const liked =
          profile.id === pendingId
            ? pendingLiked
            : profile.id in overrides
              ? overrides[profile.id]
              : !!profile.liked;
        return liked === !!profile.liked ? profile : { ...profile, liked };
      }),
    [profiles, overrides, pendingId, pendingLiked]
  );
}
