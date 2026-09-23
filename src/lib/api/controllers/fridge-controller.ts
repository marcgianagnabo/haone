import { fridgeService } from "$api/services/fridge-service";
import { roomsService } from "$api/services/rooms-service";
import { fetchFeatureFlagMulti } from "$api/utils/feature-flags";
import { FeatureFlagKey, type FridgeItemRecord, FridgeItemStatus } from "$lib/types";
import { fetchUsers, getSignedInUserId } from "./resident-controller";

export async function checkFeatureEnabled(bypassCache = false) {
  const [fridgeEnabled] = await fetchFeatureFlagMulti([FeatureFlagKey.FRIDGE_SERVICE], true);
  if (!fridgeEnabled) {
    throw new Error("Access Denied: Fridge service not enabled. Check back later!");
  }
}

async function enrichItems(
  items: FridgeItemRecord[],
  bypassCache = false
): Promise<FridgeItemRecord[]> {
  // Enrich with user names and rooms if not already provided (e.g. Supabase or direct fetch)
  // FIXME: This is really inefficient and should be optimized to avoid fetching all users and accounts every time.
  if (items.length === 0) {
    return items;
  }
  const [users, accounts] = await Promise.all([
    fetchUsers(bypassCache),
    roomsService.fetchAccounts(bypassCache)
  ]);
  const userMap = new Map(users.map((u) => [u.id, u.displayName]));
  const roomMap = new Map(accounts.map((a) => [a.residentId, a.room]));

  items.forEach((item) => {
    if (!item.residentName) {
      item.residentName = userMap.get(item.residentId);
    }
    if (!item.room) {
      item.room = roomMap.get(item.residentId) || "";
    }
    if (item.actionBy) {
      item.actionByName = userMap.get(item.actionBy) || item.actionBy;
    }
  });
  return items;
}

export async function fetchFridgeItems(
  bypassCache = false
): Promise<{ items: FridgeItemRecord[]; currentResidentId: string }> {
  await checkFeatureEnabled(bypassCache);
  const currentResidentId = await getSignedInUserId();
  // Fetch every stored item so the shared fridge board shows everyone's items.
  // The fridge_items_select RLS policy already lets residents read all rows.
  const res = await fridgeService.fetchFridgeItems(undefined, undefined, bypassCache);
  const items = await enrichItems(Array.isArray(res) ? res : res.items, bypassCache);
  return { items, currentResidentId };
}

export async function addFridgeItem(data: Partial<FridgeItemRecord>): Promise<void> {
  await checkFeatureEnabled();
  return await fridgeService.addFridgeItem(data);
}

export async function updateFridgeItem(
  id: string,
  updates: Partial<FridgeItemRecord>
): Promise<void> {
  await checkFeatureEnabled();
  return fridgeService.updateFridgeItem(id, updates);
}

export async function checkOutFridgeItem(id: string, actionBy?: string): Promise<void> {
  await checkFeatureEnabled();
  const actorId = actionBy || (await getSignedInUserId());
  return fridgeService.updateFridgeItem(id, {
    status: FridgeItemStatus.CHECKED_OUT,
    checkOutDate: new Date().toISOString(),
    actionBy: actorId
  });
}

export async function restoreFridgeItem(item: FridgeItemRecord, actionBy?: string): Promise<void> {
  await checkFeatureEnabled();
  const actorId = actionBy || (await getSignedInUserId());
  // 1. Mark existing checkout record as history
  await fridgeService.updateFridgeItem(item.id, {
    status: FridgeItemStatus.CHECKED_OUT_HISTORY,
    actionBy: actorId
  });

  // 2. Create fresh stored entry with today's date
  const newItem: Partial<FridgeItemRecord> = {
    id: crypto.randomUUID(),
    residentId: item.residentId,
    name: item.name,
    compartment: item.compartment,
    locationDetails: item.locationDetails,
    dateStored: new Date().toISOString().split("T")[0],
    expiryDate: item.expiryDate || "",
    photoUrl: item.photoUrl || "",
    status: FridgeItemStatus.STORED,
    notes: item.notes || "",
    checkOutDate: "",
    tags: item.tags || [],
    actionBy: ""
  };
  return fridgeService.addFridgeItem(newItem);
}

export async function discardFridgeItem(id: string, actionBy?: string): Promise<void> {
  await checkFeatureEnabled();
  const actorId = actionBy || (await getSignedInUserId());
  return fridgeService.deleteFridgeItem(id, actorId);
}
