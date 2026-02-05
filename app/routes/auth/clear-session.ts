import { redirect } from "react-router";
import { sessionStorage } from "~/services/auths.server";

/**
 * Clear all session data (used by error page "Clear Cache & Reload" button)
 * This route accepts GET requests since it's triggered by navigation, not form submission
 */
export async function loader({ request }: { request: Request }) {
  const session = await sessionStorage.getSession(
    request.headers.get("Cookie")
  );

  const isProduction = process.env.NODE_ENV === "production";

  // Clear customer auth token cookie
  const customerCookieParts = [
    `whoxa_customer_auth_token=`,
    `Path=/`,
    `Max-Age=0`,
    `SameSite=Lax`,
    `Expires=Thu, 01 Jan 1970 00:00:00 GMT`,
  ];

  // Clear model auth token cookie
  const modelCookieParts = [
    `whoxa_model_auth_token=`,
    `Path=/`,
    `Max-Age=0`,
    `SameSite=Lax`,
    `Expires=Thu, 01 Jan 1970 00:00:00 GMT`,
  ];

  if (isProduction) {
    customerCookieParts.push(`Domain=.xaosao.com`);
    customerCookieParts.push(`Secure`);
    modelCookieParts.push(`Domain=.xaosao.com`);
    modelCookieParts.push(`Secure`);
  }

  const headers = new Headers();
  // Clear the __session cookie (HttpOnly)
  headers.append("Set-Cookie", await sessionStorage.destroySession(session));
  // Clear customer auth token
  headers.append("Set-Cookie", customerCookieParts.join("; "));
  // Clear model auth token
  headers.append("Set-Cookie", modelCookieParts.join("; "));

  // Redirect to home page with cache headers to prevent caching
  headers.set("Cache-Control", "no-cache, no-store, must-revalidate");
  headers.set("Pragma", "no-cache");
  headers.set("Expires", "0");

  return redirect("/", { headers });
}
