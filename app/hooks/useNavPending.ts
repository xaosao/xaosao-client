/**
 * "Is this specific link the one currently loading?"
 *
 * React Router exposes the in-flight destination on `navigation.location`, so
 * a nav item can show its own spinner instead of relying only on the global
 * bar. That's the difference between "did my tap register?" and a dead-feeling
 * UI on a slow loader.
 */

import { useNavigation } from "react-router";

export function useNavPending() {
  const navigation = useNavigation();
  const pendingPath = navigation.location?.pathname ?? null;
  const pendingSearch = navigation.location?.search ?? "";

  return (url: string): boolean => {
    if (!pendingPath) return false;
    // Nav urls may carry a query string (e.g. /model/settings?tab=wallet).
    const [path, search] = url.split("?");
    if (path !== pendingPath) return false;
    return search ? `?${search}` === pendingSearch : true;
  };
}
