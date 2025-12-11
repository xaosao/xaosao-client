import { redirect } from "react-router";
import { destroyUserSession } from "~/services/auths.server";

export function action({ request }: { request: Request }) {
  if (request.method !== "POST") {
    return redirect(
      `/customer/setting?toastMessage=${encodeURIComponent(
        "Invalid request method. Please try again later"
      )}&toastType=warning`
    );
  }

  return destroyUserSession(request);
}
