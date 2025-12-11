import { useState, useEffect } from "react";

interface GeolocationState {
  latitude: number | null;
  longitude: number | null;
  accuracy: number | null;
  error: string | null;
  loading: boolean;
  permissionDenied: boolean;
}

interface UseGeolocationOptions {
  enableHighAccuracy?: boolean; // Use GPS if available (more accurate but slower)
  timeout?: number; // Max time to wait for position
  maximumAge?: number; // Max age of cached position
  watch?: boolean; // Continuously watch position (for real-time updates)
}

/**
 * React hook for browser geolocation API
 * Provides real-time, accurate location (5-50m accuracy with GPS)
 *
 * @example
 * const { latitude, longitude, error, loading } = useGeolocation({
 *   enableHighAccuracy: true,
 *   timeout: 10000,
 * });
 */
export function useGeolocation(options: UseGeolocationOptions = {}) {
  const {
    enableHighAccuracy = true,
    timeout = 10000,
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
  });

  useEffect(() => {
    // Check if geolocation is supported
    if (!navigator.geolocation) {
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
      });
    };

    const onError = (error: GeolocationPositionError) => {
      let errorMessage = "Failed to get your location";
      let permissionDenied = false;

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
      }));
    };

    const geoOptions: PositionOptions = {
      enableHighAccuracy,
      timeout,
      maximumAge,
    };

    let watchId: number | undefined;

    if (watch) {
      // Watch position for continuous updates
      watchId = navigator.geolocation.watchPosition(
        onSuccess,
        onError,
        geoOptions
      );
    } else {
      // Get position once
      navigator.geolocation.getCurrentPosition(
        onSuccess,
        onError,
        geoOptions
      );
    }

    // Cleanup
    return () => {
      if (watchId !== undefined) {
        navigator.geolocation.clearWatch(watchId);
      }
    };
  }, [enableHighAccuracy, timeout, maximumAge, watch]);

  return state;
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
  const { enableHighAccuracy = true, timeout = 10000, maximumAge = 0 } = options;

  if (!navigator.geolocation) {
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
