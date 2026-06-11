/**
 * Browser-side helper to push the caller's GPS coordinates to the server.
 *
 * The Remix `/api/location/update` route detects the caller from their
 * session cookie (customer or model) and updates the matching collection,
 * including `locationUpdatedAt`.
 *
 * Usage from a geolocation watcher:
 *
 *   navigator.geolocation.watchPosition((pos) => {
 *     // Only call when the position has actually moved a meaningful distance —
 *     // there's no per-user rate limit but constant pings still cost a DB write.
 *     updateMyLocation({
 *       lat: pos.coords.latitude,
 *       lng: pos.coords.longitude,
 *       userType: 'customer',  // or 'model'
 *     });
 *   });
 */

export interface UpdateMyLocationInput {
  lat: number;
  lng: number;
  /**
   * Required by the Remix `/api/location/update` route to pick the right
   * collection. The route also re-checks the session, so this is not a
   * trust boundary — it's just a routing hint.
   */
  userType: "customer" | "model";
}

export interface UpdateMyLocationResult {
  success: boolean;
  locationUpdatedAt?: string;
  error?: string;
}

/**
 * Push the caller's current GPS coordinates to the server.
 *
 * Returns `{ success: true, locationUpdatedAt }` on success, or
 * `{ success: false, error }` on failure. Never throws — the caller can
 * fire-and-forget without try/catch.
 */
export async function updateMyLocation(
  input: UpdateMyLocationInput
): Promise<UpdateMyLocationResult> {
  const { lat, lng, userType } = input;

  if (!Number.isFinite(lat) || lat < -90 || lat > 90) {
    return { success: false, error: "Invalid latitude" };
  }
  if (!Number.isFinite(lng) || lng < -180 || lng > 180) {
    return { success: false, error: "Invalid longitude" };
  }

  try {
    const formData = new FormData();
    formData.append("userType", userType);
    formData.append("latitude", String(lat));
    formData.append("longitude", String(lng));

    const response = await fetch("/api/location/update", {
      method: "POST",
      body: formData,
      credentials: "same-origin",
    });

    if (!response.ok) {
      return { success: false, error: `HTTP ${response.status}` };
    }

    const data = (await response.json()) as { locationUpdatedAt?: string };
    return { success: true, locationUpdatedAt: data?.locationUpdatedAt };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Network error",
    };
  }
}
