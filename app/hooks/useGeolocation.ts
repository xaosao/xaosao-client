import { useState, useEffect, useCallback } from "react";

type PermissionState = "granted" | "denied" | "prompt" | "unknown";

interface GeolocationState {
  latitude: number | null;
  longitude: number | null;
  accuracy: number | null;
  error: string | null;
  loading: boolean;
  permissionDenied: boolean;
  permissionState: PermissionState;
}

interface UseGeolocationOptions {
  enableHighAccuracy?: boolean; // Use GPS if available (more accurate but slower)
  timeout?: number; // Max time to wait for position
  maximumAge?: number; // Max age of cached position
  watch?: boolean; // Continuously watch position (for real-time updates)
}

interface UseGeolocationReturn extends GeolocationState {
  requestLocation: () => void;
  canRetry: boolean;
}

/**
 * Check the current geolocation permission state using Permissions API
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
 * React hook for browser geolocation API
 * Provides real-time, accurate location (5-50m accuracy with GPS)
 * Includes permission state tracking and retry functionality
 *
 * @example
 * const { latitude, longitude, error, loading, requestLocation, canRetry, permissionState } = useGeolocation({
 *   enableHighAccuracy: true,
 *   timeout: 10000,
 * });
 */
export function useGeolocation(options: UseGeolocationOptions = {}): UseGeolocationReturn {
  const {
    enableHighAccuracy = true,
    timeout = 15000,
    maximumAge = 0,
    watch = false,
  } = options;

  const [state, setState] = useState<GeolocationState>({
    latitude: null,
    longitude: null,
    accuracy: null,
    error: null,
    loading: true,
    permissionDenied: false,
    permissionState: "unknown",
  });

  const requestLocation = useCallback(() => {
    // Check if geolocation is supported
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setState((prev) => ({
        ...prev,
        loading: false,
        error: "Geolocation is not supported by your browser",
        permissionState: "unknown",
      }));
      return;
    }

    // IMPORTANT: Call getCurrentPosition IMMEDIATELY - before any state updates
    // iOS Safari requires the geolocation call to be synchronous with user gesture
    // Setting state first can cause iOS to lose the "user gesture" context
    navigator.geolocation.getCurrentPosition(
      (position: GeolocationPosition) => {
        setState({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          error: null,
          loading: false,
          permissionDenied: false,
          permissionState: "granted",
        });
      },
      async (error: GeolocationPositionError) => {
        let errorMessage = "Failed to get your location";
        let permissionDenied = false;
        let permState: PermissionState = await checkPermissionState();

        switch (error.code) {
          case error.PERMISSION_DENIED:
            errorMessage = "Location permission denied";
            permissionDenied = true;
            break;
          case error.POSITION_UNAVAILABLE:
            errorMessage = "Location information unavailable";
            break;
          case error.TIMEOUT:
            errorMessage = "Location request timed out";
            break;
        }

        setState((prev) => ({
          ...prev,
          loading: false,
          error: errorMessage,
          permissionDenied,
          permissionState: permState,
        }));
      },
      {
        enableHighAccuracy,
        timeout,
        maximumAge,
      }
    );

    // Set loading state AFTER the geolocation request is initiated
    // This preserves the user gesture context for iOS
    setState((prev) => ({ ...prev, loading: true, error: null }));
  }, [enableHighAccuracy, timeout, maximumAge]);

  useEffect(() => {
    // Check if geolocation is supported
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setState((prev) => ({
        ...prev,
        loading: false,
        error: "Geolocation is not supported by your browser",
      }));
      return;
    }

    const onSuccess = (position: GeolocationPosition) => {
      setState({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy,
        error: null,
        loading: false,
        permissionDenied: false,
        permissionState: "granted",
      });
    };

    const onError = async (error: GeolocationPositionError) => {
      let errorMessage = "Failed to get your location";
      let permissionDenied = false;
      let permState: PermissionState = await checkPermissionState();

      switch (error.code) {
        case error.PERMISSION_DENIED:
          errorMessage = "Location permission denied";
          permissionDenied = true;
          break;
        case error.POSITION_UNAVAILABLE:
          errorMessage = "Location information unavailable";
          break;
        case error.TIMEOUT:
          errorMessage = "Location request timed out";
          break;
      }

      setState((prev) => ({
        ...prev,
        loading: false,
        error: errorMessage,
        permissionDenied,
        permissionState: permState,
      }));
    };

    const geoOptions: PositionOptions = {
      enableHighAccuracy,
      timeout,
      maximumAge,
    };

    let watchId: number | undefined;

    // Check permission state first, then decide whether to auto-request
    checkPermissionState().then((permState) => {
      setState((prev) => ({ ...prev, permissionState: permState }));

      // Only auto-request location if permission is already granted
      // Mobile browsers require a user gesture (button click) to show permission dialogs
      // So we don't auto-request if permission is "prompt" - user must click a button
      if (permState === "granted") {
        if (watch) {
          watchId = navigator.geolocation.watchPosition(
            onSuccess,
            onError,
            geoOptions
          );
        } else {
          navigator.geolocation.getCurrentPosition(
            onSuccess,
            onError,
            geoOptions
          );
        }
      } else if (permState === "denied") {
        // Permission denied - show instructions
        setState((prev) => ({
          ...prev,
          loading: false,
          error: "Location permission denied",
          permissionDenied: true,
          permissionState: "denied",
        }));
      } else {
        // Permission is "prompt" or "unknown" - wait for user gesture
        // Set loading to false and show "Enable Location" button
        setState((prev) => ({
          ...prev,
          loading: false,
          permissionState: permState,
        }));
      }
    });

    // Listen for permission changes (when user grants permission in browser settings)
    if (typeof navigator !== "undefined" && navigator.permissions) {
      navigator.permissions.query({ name: "geolocation" }).then((result) => {
        result.onchange = () => {
          const newState = result.state as PermissionState;
          setState((prev) => ({ ...prev, permissionState: newState }));
          // If permission was just granted, try to get location again
          if (newState === "granted") {
            navigator.geolocation.getCurrentPosition(onSuccess, onError, geoOptions);
          }
        };
      }).catch(() => {
        // Permissions API not fully supported
      });
    }

    // Cleanup
    return () => {
      if (watchId !== undefined) {
        navigator.geolocation.clearWatch(watchId);
      }
    };
  }, [enableHighAccuracy, timeout, maximumAge, watch]);

  // Can retry if permission is not permanently denied
  // "prompt" means browser will show permission dialog
  // "unknown" means we can try (older browsers)
  // "denied" means browser won't show dialog again - user needs to enable manually
  const canRetry = state.permissionState !== "denied";

  return { ...state, requestLocation, canRetry };
}

/**
 * Request location permission and get coordinates
 * Use this in event handlers (e.g., button clicks)
 */
export async function requestGeolocation(
  options: Omit<UseGeolocationOptions, "watch"> = {}
): Promise<{
  latitude: number;
  longitude: number;
  accuracy: number;
} | null> {
  const { enableHighAccuracy = true, timeout = 15000, maximumAge = 0 } = options;

  if (typeof navigator === "undefined" || !navigator.geolocation) {
    console.error("Geolocation is not supported");
    return null;
  }

  try {
    const position = await new Promise<GeolocationPosition>(
      (resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy,
          timeout,
          maximumAge,
        });
      }
    );

    return {
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
      accuracy: position.coords.accuracy,
    };
  } catch (error: any) {
    console.error("Geolocation error:", error.message);
    return null;
  }
}

/**
 * Check current geolocation permission state
 * Useful for checking before requesting location
 */
export { checkPermissionState };
