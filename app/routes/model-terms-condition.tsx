import { redirect } from "react-router";

/**
 * Legacy URL — the customer + model documents merged into
 * `/terms-conditions` (rules) and `/privacy-policy` (data handling).
 * Permanent redirect so search engines and old links land cleanly
 * on the new combined page.
 */
export const loader = () => redirect("/terms-conditions?type=model", 301);

export default function ModelTermsRedirect() {
  return null;
}
