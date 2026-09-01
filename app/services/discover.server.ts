/**
 * One place that answers "give me page N of tab T for this viewer".
 *
 * Both the page loader and the infinite-scroll load-more route go through
 * here. Keeping the tab switch in a single function is the point: if they each
 * had their own copy, page 1 and page 2 could quietly come from different
 * queries and the grid would show duplicates or skip rows.
 */

import type { DiscoverProfile } from "~/components/discover/ProfileCard";
import type { DiscoverTab } from "~/components/discover/DiscoverTabs";
import { calculateAgeFromDOB } from "~/utils";

/**
 * Rows per page in the Discover grid.
 *
 * Overridable via env so a small local dataset can be paged aggressively for
 * testing infinite scroll without shipping that value — set
 * `DISCOVER_PAGE_SIZE` in .env to tune per environment; the default below
 * applies otherwise.
 * Read once at module load: it isn't per-request state.
 */
// 10 divides evenly into the grid: 2 full rows at the 5-column desktop
// breakpoint, 5 rows at the 2-column mobile one.
const PAGE_SIZE_DEFAULT = 10;
const PAGE_SIZE_FROM_ENV = Number(process.env.DISCOVER_PAGE_SIZE);

export const DISCOVER_PAGE_SIZE =
  Number.isInteger(PAGE_SIZE_FROM_ENV) &&
  PAGE_SIZE_FROM_ENV > 0 &&
  PAGE_SIZE_FROM_ENV <= 100
    ? PAGE_SIZE_FROM_ENV
    : PAGE_SIZE_DEFAULT;

export interface DiscoverPage {
  profiles: DiscoverProfile[];
  hasMore: boolean;
  page: number;
}

/**
 * The list helpers disagree on how they report "another page exists" —
 * `hasMore` in one, `hasNextPage` in another, nothing at all in a third. Fall
 * back to a full page meaning "probably more", which is the standard
 * assumption and self-corrects on the next request.
 */
function resolveHasMore(
  pagination: any,
  rowCount: number,
  perPage: number
): boolean {
  if (typeof pagination?.hasMore === "boolean") return pagination.hasMore;
  if (typeof pagination?.hasNextPage === "boolean") return pagination.hasNextPage;
  return rowCount === perPage;
}

/** Map either a model row or a customer row onto the card's shape. */
function toProfile(row: any, likedField: "customerAction" | "modelAction"): DiscoverProfile {
  return {
    id: row.id,
    firstName: row.firstName ?? null,
    lastName: row.lastName ?? null,
    profile: row.profile ?? null,
    age: row.dob ? calculateAgeFromDOB(row.dob) : null,
    distance: typeof row.distance === "number" ? row.distance : null,
    rating: row.rating ?? 0,
    vip: !!row.vip,
    hidden: !!row.profileHiddenByAdmin,
    liked: row[likedField] === "LIKE",
  };
}

/** Customer browsing models. */
export async function loadCustomerDiscover(
  customerId: string,
  tab: DiscoverTab,
  page: number,
  hasLocation: boolean
): Promise<DiscoverPage> {
  const {
    getNearbyModels,
    getModelsForCustomer,
    getLikeMeModels,
    getModelsByInteraction,
  } = await import("~/services/model.server");

  const perPage = DISCOVER_PAGE_SIZE;
  let rows: any[] = [];
  let pagination: any = null;

  try {
    switch (tab) {
      case "likeMe": {
        const result = await getLikeMeModels(customerId, page, perPage);
        rows = result?.models ?? [];
        pagination = result?.pagination;
        break;
      }
      case "iLike": {
        const result = await getModelsByInteraction(customerId, "LIKE", page, perPage);
        rows = result?.models ?? [];
        pagination = result?.pagination;
        break;
      }
      case "forYou": {
        // Returns the whole (cached) list rather than a page, so slice it.
        const all = await getModelsForCustomer(customerId, {});
        const list = Array.isArray(all) ? all : [];
        rows = list.slice((page - 1) * perPage, page * perPage);
        pagination = { hasMore: page * perPage < list.length };
        break;
      }
      default: {
        if (hasLocation) {
          const result = await getNearbyModels(customerId, {}, 10_000, {
            page,
            limit: perPage,
          });
          rows = result?.models ?? [];
          pagination = result?.pagination;
        }
        if (!hasLocation || (page === 1 && rows.length === 0)) {
          // No location (or nothing nearby) — fall back to the general list so
          // the tab is never blank just because a permission was declined.
          const all = await getModelsForCustomer(customerId, {});
          const list = Array.isArray(all) ? all : [];
          rows = list.slice((page - 1) * perPage, page * perPage);
          pagination = { hasMore: page * perPage < list.length };
        }
      }
    }
  } catch (error) {
    console.error("[discover] customer query failed:", (error as Error)?.message);
    return { profiles: [], hasMore: false, page };
  }

  return {
    profiles: rows.map((row) => toProfile(row, "customerAction")),
    hasMore: resolveHasMore(pagination, rows.length, perPage),
    page,
  };
}

/** Model browsing customers. */
export async function loadModelDiscover(
  modelId: string,
  tab: DiscoverTab,
  page: number,
  coords: { lat?: number | null; lng?: number | null }
): Promise<DiscoverPage> {
  const {
    getForYouCustomers,
    getCustomersWhoLikedMe,
    getCustomersByModelInteraction,
  } = await import("~/services/model.server");

  const perPage = DISCOVER_PAGE_SIZE;
  let rows: any[] = [];
  let pagination: any = null;

  try {
    switch (tab) {
      case "likeMe": {
        const result = await getCustomersWhoLikedMe(modelId, page, perPage);
        rows = result?.customers ?? [];
        pagination = result?.pagination;
        break;
      }
      case "iLike": {
        const result = await getCustomersByModelInteraction(modelId, "LIKE", page, perPage);
        rows = result?.customers ?? [];
        pagination = result?.pagination;
        break;
      }
      default: {
        const result = await getForYouCustomers(modelId, {
          page,
          perPage,
          // "all" drops the distance ceiling so nothing is hidden merely for
          // being far away; "forYou" keeps it tight.
          maxDistance: tab === "forYou" ? 50 : undefined,
          modelLat: coords.lat ?? undefined,
          modelLng: coords.lng ?? undefined,
        });
        rows = result?.customers ?? [];
        pagination = result?.pagination;
      }
    }
  } catch (error) {
    console.error("[discover] model query failed:", (error as Error)?.message);
    return { profiles: [], hasMore: false, page };
  }

  return {
    profiles: rows.map((row) => toProfile(row, "modelAction")),
    hasMore: resolveHasMore(pagination, rows.length, perPage),
    page,
  };
}
