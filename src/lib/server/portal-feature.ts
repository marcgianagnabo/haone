import { env } from "$env/dynamic/public";

export function isPortalFeatureEnabled(): boolean {
  return env.PUBLIC_PORTAL_FEATURE_ENABLED !== "false";
}
