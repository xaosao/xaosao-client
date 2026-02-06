import type { LoaderFunction } from "react-router";
import { requireUserSession } from "~/services/auths.server";
import { getNearbyModels } from "~/services/model.server";
import type { INearbyModelResponse } from "~/interfaces";

export const loader: LoaderFunction = async ({ request }) => {
    const customerId = await requireUserSession(request);

    // Parse pagination and filter parameters from URL
    const url = new URL(request.url);
    const page = parseInt(url.searchParams.get("page") || "1", 10);
    const limit = parseInt(url.searchParams.get("limit") || "50", 10);

    // Parse filter parameters
    const filters = {
        search: url.searchParams.get("search") || undefined,
        services: url.searchParams.getAll("services").filter(Boolean),
        maxDistance: url.searchParams.get("distance") ? Number(url.searchParams.get("distance")) : undefined,
        ageRange: url.searchParams.get("ageMin") && url.searchParams.get("ageMax")
            ? [Number(url.searchParams.get("ageMin")), Number(url.searchParams.get("ageMax"))] as [number, number]
            : undefined,
        gender: url.searchParams.get("gender") || undefined,
        minRating: url.searchParams.get("rating") ? Number(url.searchParams.get("rating")) : undefined,
    };

    // Get nearby models with pagination
    const result = await getNearbyModels(customerId, filters, 50, { page, limit });

    return {
        models: result.models as INearbyModelResponse[],
        pagination: result.pagination,
    };
};
