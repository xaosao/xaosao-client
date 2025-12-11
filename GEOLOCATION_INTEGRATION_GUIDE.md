# Geolocation Integration Guide

This guide shows how to implement accurate user location tracking for your dating platform.

## Overview

The system uses a **hybrid approach** for maximum accuracy:

1. **Browser Geolocation API** (Primary) - 5-50m accuracy via GPS
2. **IP Geolocation** (Fallback) - 50-200km accuracy via IP address

## Files Created

- `app/services/geolocation.server.ts` - Server-side IP geolocation
- `app/hooks/useGeolocation.ts` - Client-side browser geolocation hook

---

## Implementation Steps

### 1. Update Customer Location on Login (Server-Side)

Add IP-based geolocation to your login action:

```typescript
// app/routes/auth/login.tsx

import { getUserLocation } from "~/services/geolocation.server";

export async function action({ request }: Route.ActionArgs) {
  const formData = await request.formData();
  const whatsapp = formData.get("whatsapp") as string;
  const password = formData.get("password") as string;

  // ... existing validation ...

  try {
    const res = await customerLogin(
      Number(whatsapp),
      password,
      rememberMe === "true"
    );

    // Get location from IP address (fallback)
    const location = await getUserLocation(request);

    if (location.success && location.latitude && location.longitude) {
      // Update customer location in database
      await prisma.customer.update({
        where: { id: res.customerId }, // Assuming login returns customer ID
        data: {
          latitude: location.latitude,
          longitude: location.longitude,
          address: location.city
            ? `${location.city}, ${location.country}`
            : location.country,
        },
      });
    }

    return res;
  } catch (error: any) {
    // ... error handling ...
  }
}
```

### 2. Request Precise Location on Client (Client-Side)

Create a location permission component for dashboard:

```typescript
// app/components/LocationPermission.tsx

import { useGeolocation } from "~/hooks/useGeolocation";
import { useFetcher } from "@remix-run/react";
import { useEffect } from "react";

export function LocationPermission() {
  const fetcher = useFetcher();
  const { latitude, longitude, error, loading, permissionDenied } = useGeolocation({
    enableHighAccuracy: true,
    timeout: 10000,
  });

  useEffect(() => {
    // When we get accurate location, send it to server
    if (latitude && longitude && !loading) {
      fetcher.submit(
        {
          latitude: latitude.toString(),
          longitude: longitude.toString(),
          source: "gps",
        },
        {
          method: "post",
          action: "/api/update-location",
        }
      );
    }
  }, [latitude, longitude, loading]);

  if (loading) {
    return (
      <div className="p-4 bg-blue-50 rounded-lg">
        <p className="text-sm text-blue-700">Getting your location...</p>
      </div>
    );
  }

  if (permissionDenied) {
    return (
      <div className="p-4 bg-yellow-50 rounded-lg">
        <p className="text-sm text-yellow-700">
          📍 Location access denied. We'll use approximate location for matching.
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 rounded-lg">
        <p className="text-sm text-red-700">
          ⚠️ {error}
        </p>
      </div>
    );
  }

  return (
    <div className="p-4 bg-green-50 rounded-lg">
      <p className="text-sm text-green-700">
        ✓ Location updated successfully
      </p>
    </div>
  );
}
```

### 3. Create API Route to Update Location

```typescript
// app/routes/api/update-location.tsx

import { prisma } from "~/services/database.server";
import { requireUserSession } from "~/services/session.server";

export async function action({ request }: Route.ActionArgs) {
  const session = await requireUserSession(request);
  const customerId = session.get("customerId");

  const formData = await request.formData();
  const latitude = parseFloat(formData.get("latitude") as string);
  const longitude = parseFloat(formData.get("longitude") as string);
  const source = formData.get("source") as string;

  if (!latitude || !longitude) {
    return { success: false, error: "Invalid coordinates" };
  }

  try {
    await prisma.customer.update({
      where: { id: customerId },
      data: {
        latitude,
        longitude,
        // Optionally reverse geocode to get address
        // You can use a service like Nominatim or Google Maps Geocoding API
      },
    });

    return { success: true, source };
  } catch (error: any) {
    console.error("UPDATE_LOCATION_ERROR:", error);
    return { success: false, error: error.message };
  }
}
```

### 4. Add Location Permission Request to Dashboard

```typescript
// app/routes/dashboard.tsx

import { LocationPermission } from "~/components/LocationPermission";

export default function Dashboard() {
  return (
    <div>
      {/* Show location permission request */}
      <LocationPermission />

      {/* Rest of dashboard */}
    </div>
  );
}
```

---

## Comparison: IP vs Browser Geolocation

| Method | Accuracy | Permission Required | Battery Impact | Use Case |
|--------|----------|-------------------|----------------|----------|
| **IP Geolocation** | 50-200km | ❌ No | None | Initial/fallback location |
| **Browser GPS** | 5-50m | ✅ Yes | Medium | Precise matching, nearby search |
| **Browser Network** | 100-500m | ✅ Yes | Low | Good balance |

---

## Best Practices

### 1. **Progressive Enhancement**
```typescript
// Start with IP location (automatic)
// → Ask for permission on dashboard
// → Use precise location for matching
```

### 2. **Graceful Degradation**
```typescript
if (hasGPSLocation) {
  // Use high precision matching
} else if (hasIPLocation) {
  // Use city-level matching
} else {
  // Use country/manual location
}
```

### 3. **Privacy & Transparency**
- Show users why you need location
- Allow manual location entry
- Don't block features if permission denied
- Store only necessary precision (e.g., city-level for privacy)

### 4. **Update Strategy**
```typescript
// Update location:
// - On login (IP-based)
// - On dashboard load (GPS-based)
// - When user manually updates profile
// - Periodically if watching position (battery consideration)
```

---

## Example: Complete Login Flow

```typescript
// app/routes/auth/login.tsx

export async function action({ request }: Route.ActionArgs) {
  const formData = await request.formData();
  const whatsapp = formData.get("whatsapp") as string;
  const password = formData.get("password") as string;

  try {
    // 1. Authenticate user
    const loginResult = await customerLogin(
      Number(whatsapp),
      password,
      rememberMe === "true"
    );

    // 2. Get approximate location from IP (non-blocking)
    const ipLocation = await getUserLocation(request);

    // 3. Update location if available (don't fail login if this fails)
    if (ipLocation.success && ipLocation.latitude && ipLocation.longitude) {
      await prisma.customer.update({
        where: { whatsapp: Number(whatsapp) },
        data: {
          latitude: ipLocation.latitude,
          longitude: ipLocation.longitude,
          address: ipLocation.city
            ? `${ipLocation.city}, ${ipLocation.country}`
            : ipLocation.country || "Unknown",
        },
      }).catch(err => {
        // Log but don't fail login
        console.error("Failed to update location on login:", err);
      });
    }

    // 4. Return success (user can provide precise location later)
    return loginResult;
  } catch (error: any) {
    // ... error handling ...
  }
}
```

---

## API Rate Limits & Costs

### Free Tier Recommendations:

1. **ipapi.co** (Recommended)
   - Free: 1,000 requests/month
   - Paid: $10/month for 30,000 requests
   - Best for: Small to medium apps

2. **ip-api.com**
   - Free: 45 requests/minute
   - Paid: $13/month for unlimited
   - Best for: High-traffic apps

3. **Browser Geolocation**
   - Always free
   - Best for: Accuracy (use as primary)

---

## Testing

### Test with Different IPs:
```bash
# Test IP geolocation
curl "https://ipapi.co/8.8.8.8/json/"
```

### Test Browser Geolocation:
```typescript
// In browser console
navigator.geolocation.getCurrentPosition(
  (pos) => console.log(pos.coords),
  (err) => console.error(err)
);
```

---

## Security Considerations

1. **Don't expose exact coordinates publicly** - Round to nearest km for display
2. **Validate coordinates** - Check lat/lng are within valid ranges
3. **Rate limit location updates** - Prevent abuse
4. **Use HTTPS** - Required for browser geolocation API

---

## Recommended Implementation Order

1. ✅ Add IP geolocation to login (server-side) - **Start here**
2. ✅ Create location update API endpoint
3. ✅ Add browser geolocation hook to dashboard
4. ✅ Show permission request UI
5. ✅ Update model queries to use location
6. ✅ Add manual location entry option (fallback)
7. ✅ Add location privacy settings

This gives you 100% accurate distance calculations for users who grant permission, with automatic fallback for those who don't!
