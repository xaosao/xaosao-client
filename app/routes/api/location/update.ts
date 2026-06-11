import type { ActionFunction } from "react-router";
import { getUserFromSession } from "~/services/auths.server";
import { getModelFromSession } from "~/services/model-auth.server";
import { prisma } from "~/services/database.server";

/**
 * API endpoint to update user location silently in the background
 * Supports both customers and models
 * POST /api/location/update
 */
export const action: ActionFunction = async ({ request }) => {
  if (request.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    const formData = await request.formData();
    const userType = formData.get("userType") as "model" | "customer";
    const latitudeRaw = formData.get("latitude");
    const longitudeRaw = formData.get("longitude");

    if (!userType || !latitudeRaw || !longitudeRaw) {
      return Response.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Parse and validate coordinates
    const latitude = parseFloat(String(latitudeRaw));
    const longitude = parseFloat(String(longitudeRaw));

    if (isNaN(latitude) || isNaN(longitude)) {
      return Response.json({ error: "Invalid coordinates" }, { status: 400 });
    }

    if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
      return Response.json({ error: "Coordinates out of range" }, { status: 400 });
    }

    const now = new Date();

    if (userType === "model") {
      const modelId = await getModelFromSession(request);
      if (!modelId) {
        return Response.json({ error: "Unauthorized" }, { status: 401 });
      }

      await prisma.model.update({
        where: { id: modelId },
        data: {
          latitude,
          longitude,
          locationUpdatedAt: now,
          updatedAt: now,
        },
      });

      console.log(`Model ${modelId} location updated: (${latitude}, ${longitude})`);
    } else {
      const customerId = await getUserFromSession(request);
      if (!customerId) {
        return Response.json({ error: "Unauthorized" }, { status: 401 });
      }

      await prisma.customer.update({
        where: { id: customerId },
        data: {
          latitude,
          longitude,
          locationUpdatedAt: now,
          updatedAt: now,
        },
      });

      console.log(`Customer ${customerId} location updated: (${latitude}, ${longitude})`);
    }

    return Response.json({ success: true, locationUpdatedAt: now.toISOString() });
  } catch (error) {
    console.error("LOCATION_UPDATE_FAILED", error);
    return Response.json({ error: "Failed to update location" }, { status: 500 });
  }
};
