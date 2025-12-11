import { redirect } from "react-router";
import { destroyModelSession } from "~/services/model-auth.server";

export function action({ request }: { request: Request }) {
  if (request.method !== "POST") {
    return redirect(
      `/model/settings?toastMessage=${encodeURIComponent(
        "Invalid request method. Please try again later"
      )}&toastType=warning`
    );
  }

  return destroyModelSession(request);
}
