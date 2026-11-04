import { isPortalFeatureEnabled } from "$lib/server/portal-feature";
import { error } from "@sveltejs/kit";
import type { LayoutServerLoad } from "./$types";

export const load: LayoutServerLoad = () => {
  if (!isPortalFeatureEnabled()) error(404, "Portal management is disabled");
  return {};
};
