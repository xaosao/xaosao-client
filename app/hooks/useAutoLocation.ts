import { useState, useEffect, useCallback, useRef } from "react";

type PermissionState = "granted" | "denied" | "prompt" | "unknown";

interface UseAutoLocationOptions {
  userType: "customer" | "model";
  enabled?: boolean; // Enable/disable the hook
  onNeedPermission?: () => void; // Callback when we need user to grant permission (for soft prompt)
}

interface UseAutoLocationReturn {
  latitude: number | null;
  longitude: number | null;
  loading: boolean;
  error: string | null;
  permissionState: PermissionState;
  hasLocation: boolean;
  requestLocation: () => void; // Manual trigger for location request
  isUpdating: boolean; // Whether we're updating the server
}

/**
 * Detect if the user is on a mobile device
 */
function isMobileDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent
  );
}

/**
 * Check the current geolocation permission state
 */
async function checkPermissionState(): Promise<PermissionState> {
  if (typeof navigator === "undefined" || !navigator.permissions) {
    return "unknown";
  }

  try {
    const result = await navigator.permissions.query({ name: "geolocation" });
    return result.state as PermissionState;
  } catch {
    return "unknown";
  }
}

/**
 * Update location on the server
 */
async function updateLocationOnServer(
  latitude: number,
  longitude: number,
  userType: "customer" | "model"
): Promise<boolean> {
  try {
    const formData = new FormData();
    formData.append("userType", userType);
    formData.append("latitude", String(latitude));
    formData.append("longitude", String(longitude));

    const response = await fetch("/api/location/update", {
      method: "POST",
      body: formData,
      credentials: "same-origin", // Include cookies for session authentication
    });

    return response.ok;
  } catch (error) {
    console.error("Failed to update location on server:", error);
    return false;
  }
}

/**
 * Hook for automatic location tracking
 * - Auto-requests location if permission is already granted
 * - On desktop, tries to auto-request even with "prompt" state
 * - On mobile with "prompt", calls onNeedPermission callback
 * - Silently updates the server when location is obtained
 */
export function useAutoLocation(options: UseAutoLocationOptions): UseAutoLocationReturn {
  const { userType, enabled = true, onNeedPermission } = options;

  const [state, setState] = useState<{
    latitude: number | null;
    longitude: number | null;
    loading: boolean;
    error: string | null;
    permissionState: PermissionState;
    isUpdating: boolean;
  }>({
    latitude: null,
    longitude: null,
    loading: true,
    error: null,
    permissionState: "unknown",
    isUpdating: false,
  });

  const hasAttemptedRef = useRef(false);
  const hasUpdatedServerRef = useRef(false);

  // Request location manually (e.g., from a button click)
  const requestLocation = useCallback(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setState((prev) => ({
        ...prev,
        loading: false,
        error: "Geolocation not supported",
      }));
      return;
    }

    // Call getCurrentPosition IMMEDIATELY - before any state updates
    // This is critical for iOS Safari which requires the call to be synchronous with user gesture
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;

        setState((prev) => ({
          ...prev,
          latitude,
          longitude,
          loading: false,
          error: null,
          permissionState: "granted",
          isUpdating: true,
        }));

        // Update server
        const success = await updateLocationOnServer(latitude, longitude, userType);
        hasUpdatedServerRef.current = success;

        setState((prev) => ({
          ...prev,
          isUpdating: false,
        }));
      },
      async (error) => {
        let errorMessage = "Failed to get location";
        const permState = await checkPermissionState();

        switch (error.code) {
          case error.PERMISSION_DENIED:
            errorMessage = "Location permission denied";
            break;
          case error.POSITION_UNAVAILABLE:
            errorMessage = "Location unavailable";
            break;
          case error.TIMEOUT:
            errorMessage = "Location request timed out";
            break;
        }

        setState((prev) => ({
          ...prev,
          loading: false,
          error: errorMessage,
          permissionState: permState,
        }));
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0,
      }
    );

    // Set loading AFTER the geolocation request is initiated
    setState((prev) => ({ ...prev, loading: true, error: null }));
  }, [userType]);

  // Auto-request location on mount
  useEffect(() => {
    if (!enabled || hasAttemptedRef.current) return;
    hasAttemptedRef.current = true;

    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setState((prev) => ({
        ...prev,
        loading: false,
        error: "Geolocation not supported",
      }));
      return;
    }

    const attemptAutoLocation = async () => {
      const permState = await checkPermissionState();
      setState((prev) => ({ ...prev, permissionState: permState }));

      // If permission is already granted, auto-request
      if (permState === "granted") {
        navigator.geolocation.getCurrentPosition(
          async (position) => {
            const { latitude, longitude } = position.coords;

            setState((prev) => ({
              ...prev,
              latitude,
              longitude,
              loading: false,
              error: null,
              permissionState: "granted",
              isUpdating: true,
            }));

            // Update server
            const success = await updateLocationOnServer(latitude, longitude, userType);
            hasUpdatedServerRef.current = success;

            setState((prev) => ({
              ...prev,
              isUpdating: false,
            }));
          },
          () => {
            setState((prev) => ({
              ...prev,
              loading: false,
              error: "Failed to get location",
            }));
          },
          {
            enableHighAccuracy: true,
            timeout: 15000,
            maximumAge: 60000, // Allow cached position up to 1 minute
          }
        );
        return;
      }

      // If permission is denied, just show error
      if (permState === "denied") {
        setState((prev) => ({
          ...prev,
          loading: false,
          error: "Location permission denied",
          permissionState: "denied",
        }));
        return;
      }

      // Permission is "prompt" or "unknown"
      const isMobile = isMobileDevice();

      if (!isMobile) {
        // On desktop, try to auto-request - it often works without user gesture
        navigator.geolocation.getCurrentPosition(
          async (position) => {
            const { latitude, longitude } = position.coords;

            setState((prev) => ({
              ...prev,
              latitude,
              longitude,
              loading: false,
              error: null,
              permissionState: "granted",
              isUpdating: true,
            }));

            // Update server
            const success = await updateLocationOnServer(latitude, longitude, userType);
            hasUpdatedServerRef.current = success;

            setState((prev) => ({
              ...prev,
              isUpdating: false,
            }));
          },
          async () => {
            const newPermState = await checkPermissionState();
            setState((prev) => ({
              ...prev,
              loading: false,
              permissionState: newPermState,
            }));

            // If still "prompt", call the callback to show soft prompt
            if (newPermState === "prompt" && onNeedPermission) {
              onNeedPermission();
            }
          },
          {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 0,
          }
        );
      } else {
        // On mobile, don't auto-request (it will fail)
        // Call the callback to show soft prompt
        setState((prev) => ({
          ...prev,
          loading: false,
        }));

        if (onNeedPermission) {
          onNeedPermission();
        }
      }
    };

    attemptAutoLocation();

    // Listen for permission changes
    if (typeof navigator !== "undefined" && navigator.permissions) {
      navigator.permissions
        .query({ name: "geolocation" })
        .then((result) => {
          result.onchange = () => {
            const newState = result.state as PermissionState;
            setState((prev) => ({ ...prev, permissionState: newState }));

            // If permission was just granted, try to get location
            if (newState === "granted" && !hasUpdatedServerRef.current) {
              navigator.geolocation.getCurrentPosition(
                async (position) => {
                  const { latitude, longitude } = position.coords;

                  setState((prev) => ({
                    ...prev,
                    latitude,
                    longitude,
                    loading: false,
                    error: null,
                    permissionState: "granted",
                    isUpdating: true,
                  }));

                  const success = await updateLocationOnServer(latitude, longitude, userType);
                  hasUpdatedServerRef.current = success;

                  setState((prev) => ({
                    ...prev,
                    isUpdating: false,
                  }));
                },
                () => {}
              );
            }
          };
        })
        .catch(() => {});
    }
  }, [enabled, userType, onNeedPermission]);

  return {
    ...state,
    hasLocation: state.latitude !== null && state.longitude !== null,
    requestLocation,
  };
}
