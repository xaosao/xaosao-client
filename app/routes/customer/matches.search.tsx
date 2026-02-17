import type { LoaderFunction } from "react-router";
import { requireUserSession } from "~/services/auths.server";
import { searchModels } from "~/services/model.server";

export const loader: LoaderFunction = async ({ request }) => {
    const customerId = await requireUserSession(request);
    const url = new URL(request.url);
    const query = url.searchParams.get("q") || "";

    if (query.length < 2) {
        return { models: [] };
    }

    const models = await searchModels(customerId, query);
    return { models };
};
