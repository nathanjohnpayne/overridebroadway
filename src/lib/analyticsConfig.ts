import type { AnalyticsSettings } from "firebase/analytics";

/**
 * Routes whose query string carries an access credential (the deal room share
 * token). Analytics hits sent from these pages must not include the query.
 */
const CREDENTIAL_QUERY_PATHS = ["/deal-room"];

function isCredentialPath(pathname: string): boolean {
  return CREDENTIAL_QUERY_PATHS.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`)
  );
}

/**
 * Analytics settings for the page Analytics is initialized on.
 *
 * On credential-bearing routes, pins `page_location` to origin + path (no
 * query string, no fragment) so every hit reports the stripped URL, and turns
 * off the automatic page_view — the page logs its own non-secret event.
 */
export function analyticsSettingsForLocation(
  location: Pick<Location, "origin" | "pathname">
): AnalyticsSettings {
  if (!isCredentialPath(location.pathname)) return {};
  return {
    config: {
      page_location: `${location.origin}${location.pathname}`,
      send_page_view: false,
    },
  };
}
