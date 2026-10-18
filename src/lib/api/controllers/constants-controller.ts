import { constantsService } from "$api/services/constants-service";
import { type ConstantRecord } from "$lib/types";

export async function fetchConstants(bypassCache = false): Promise<ConstantRecord[]> {
  return constantsService.fetchConstants(bypassCache);
}

export async function fetchConstantByKey(key: string): Promise<string | null> {
  return constantsService.fetchConstantByKey(key);
}

export async function fetchActiveTerm(bypassCache = false): Promise<string> {
  const val = await constantsService.fetchConstantByKey("TERM_CURR");
  return val || "";
}

export async function fetchMopTypes(
  bypassCache = false
): Promise<{ value: string; label: string }[]> {
  const constants = await constantsService.fetchConstants(bypassCache);
  return constants
    .filter((c) => c.key.startsWith("MOP_"))
    .map((c) => ({
      value: c.value || c.key,
      label: c.description || c.value || c.key
    }));
}

export async function fetchTerms(
  bypassCache = false
): Promise<{ value: string; label: string; description: string }[]> {
  const constants = await constantsService.fetchConstants(bypassCache);
  return constants
    .filter((c) => c.key.startsWith("TERM_") && c.key !== "TERM_CURR")
    .map((c) => ({
      value: c.value,
      label: c.value,
      description: c.description
    }));
}

export async function addConstant(key: string, value: string, description = ""): Promise<void> {
  return constantsService.addConstant(key, value, description);
}

export async function updateConstant(key: string, value: string): Promise<void> {
  return constantsService.updateConstant(key, value);
}

export async function batchUpdateConstants(
  updates: { range: string; values: any[][] }[]
): Promise<void> {
  return constantsService.batchUpdateConstants(updates);
}
