import { goto } from "$app/navigation";
import type { BrandingProfile } from "$lib/types";
import { type ResidentRecord, type UserRecord, AccountType, FeatureFlagKey } from "$lib/types";
import { emailDispatcher } from "$state/dispatcher.svelte";
import { ClearanceCertificateTemplate } from "$templates/clearance";
import { PaymentStatusTemplate, StatementOfAccountTemplate } from "$templates/payment-status";

import { parseCSVAmount } from "$utils/math";
import { computeDisplayNames, mapRowToJournal, mapRowToResident } from "../utils/row-mappers";

export { computeDisplayNames, mapRowToJournal, mapRowToResident, parseCSVAmount };

import { constantsService } from "$api/services/constants-service";
import { residentService } from "$api/services/resident-service";
import { fetchFeatureFlagMulti } from "$api/utils/feature-flags";
import { getCustomServices } from "$lib/services";

/**
 * Resolves the primary identifier (UUID) of the currently signed-in user.
 */
export async function getSignedInUserId(): Promise<string> {
  const { auth } = await import("$state/auth.svelte");
  if (!auth.userId) {
    throw new Error("User ID is unavailable.");
  }
  // The token endpoint resolves identities with an unauthenticated client and
  // can return a placeholder id. Prefer the real public.users id so row
  // filters (payment requests, laundry, fridge, settings) match stored ids.
  const email = auth.user?.email;
  if (email) {
    const { resolveUserIdByEmail } = await import("$api/services/common");
    const resolved = await resolveUserIdByEmail(email);
    if (resolved) {
      return resolved;
    }
  }
  return auth.userId;
}

/**
 * Fetches resident status (dashboard context) via direct DB in Supabase mode or API route in Sheets mode.
 */
export async function fetchResidentStatus(term?: string, bypassCache = false): Promise<any> {
  return residentService.fetchResidentStatus(term, bypassCache);
}

/**
 * Fetches joined resident data from Accounts and ResidentRecords spreadsheets/database.
 */
export async function fetchResidents(
  bypassCache = false,
  term?: string
): Promise<ResidentRecord[]> {
  return residentService.fetchResidents(bypassCache, term);
}

export async function fetchUsers(bypassCache = false): Promise<UserRecord[]> {
  return residentService.fetchUsers(bypassCache);
}

/**
 * Fetches the current active term from constants.
 */
export async function fetchActiveTerm(bypassCache = false): Promise<string> {
  const val = await constantsService.fetchConstantByKey("TERM_CURR");
  return val || "";
}

/**
 * Fetches a single user by their ID.
 */
export async function fetchUserById(id: string, bypassCache = false): Promise<UserRecord | null> {
  const users = await fetchUsers(bypassCache);
  return users.find((u) => u.id === id) || null;
}

/**
 * Updates a user record in the ResidentRecords spreadsheet/database.
 */
export async function updateUser(userId: string, data: Partial<UserRecord>) {
  return residentService.updateUser(userId, data);
}

export async function addUser(data: Partial<UserRecord>) {
  return residentService.addUser(data);
}

export async function fetchAccountsByUserId(
  userId: string,
  bypassCache = false
): Promise<ResidentRecord[]> {
  const allResidents = await fetchResidents(bypassCache);
  return allResidents.filter((r) => r.residentId === userId);
}

export async function deleteUser(userId: string) {
  const accounts = await fetchAccountsByUserId(userId);
  if (accounts.length > 0) {
    throw new Error(`Cannot delete user: ${accounts.length} linked account(s) found.`);
  }
  return residentService.deleteUser(userId);
}

export async function determineAllowedAccountOptions() {
  // based on feature flag
  return await fetchFeatureFlagMulti(
    [FeatureFlagKey.ONBOARDING_ACCTYPE_UHO, FeatureFlagKey.ONBOARDING_ACCTYPE_ALUMNI],
    true
  );
}

export async function registerResident(data: Record<string, any>): Promise<void> {
  return residentService.registerResident(data);
}

/**
 * Stages a single status reminder email in the dispatcher.
 */
export function stageStatusEmail(
  resident: ResidentRecord,
  branding: BrandingProfile,
  options: {
    clearQueue?: boolean;
    customReminders?: string;
    redirect?: boolean;
  } = {}
) {
  if (options.clearQueue) {
    emailDispatcher.clear();
  }

  emailDispatcher.configType = "reminders";
  emailDispatcher.batchType = "REMINDER";

  if (options.customReminders) {
    emailDispatcher.customReminders = options.customReminders;
  } else if (branding.defaultReminders) {
    emailDispatcher.customReminders = branding.defaultReminders;
  }

  emailDispatcher.push(
    mapResidentToStagedEmail(resident, branding, "REMINDER", emailDispatcher.customReminders)
  );

  if (options.redirect) {
    goto("/admin/email-dispatcher");
  }
}

/**
 * Stages multiple statement of account emails.
 */
export function stageSoaEmailBatch(
  residents: ResidentRecord[],
  branding: BrandingProfile,
  options: {
    clearQueue?: boolean;
    customReminders?: string;
    redirect?: boolean;
  } = {}
) {
  if (options.clearQueue) {
    emailDispatcher.clear();
  }

  emailDispatcher.configType = "reminders";
  emailDispatcher.batchType = "SOA";

  if (options.customReminders) {
    emailDispatcher.customReminders = options.customReminders;
  } else if (branding.defaultReminders) {
    emailDispatcher.customReminders = branding.defaultReminders;
  }

  for (const r of residents) {
    emailDispatcher.push(
      mapResidentToStagedEmail(r, branding, "SOA", emailDispatcher.customReminders)
    );
  }

  if (options.redirect) {
    goto("/admin/email-dispatcher");
  }
}

/**
 * Stages multiple status reminder emails.
 */
export function stageStatusEmailBatch(
  residents: ResidentRecord[],
  branding: BrandingProfile,
  options: {
    clearQueue?: boolean;
    customReminders?: string;
    redirect?: boolean;
  } = {}
) {
  if (options.clearQueue) {
    emailDispatcher.clear();
  }

  emailDispatcher.configType = "reminders";
  emailDispatcher.batchType = "REMINDER";

  if (options.customReminders) {
    emailDispatcher.customReminders = options.customReminders;
  } else if (branding.defaultReminders) {
    emailDispatcher.customReminders = branding.defaultReminders;
  }

  for (const r of residents) {
    emailDispatcher.push(
      mapResidentToStagedEmail(r, branding, "REMINDER", emailDispatcher.customReminders)
    );
  }

  if (options.redirect) {
    goto("/admin/email-dispatcher");
  }
}

/**
 * Stages a single clearance certificate email.
 */
export function stageClearanceEmail(
  resident: ResidentRecord,
  branding: BrandingProfile,
  options: {
    clearQueue?: boolean;
    redirect?: boolean;
  } = {}
) {
  if (options.clearQueue) {
    emailDispatcher.clear();
  }

  emailDispatcher.configType = "reminders";
  emailDispatcher.batchType = "CLEARANCE";

  emailDispatcher.push(mapResidentToStagedClearance(resident, branding));

  if (options.redirect) {
    goto("/admin/email-dispatcher");
  }
}

/**
 * Stages multiple clearance certificate emails.
 */
export function stageClearanceEmailBatch(
  residents: ResidentRecord[],
  branding: BrandingProfile,
  options: {
    clearQueue?: boolean;
    redirect?: boolean;
  } = {}
) {
  if (options.clearQueue) {
    emailDispatcher.clear();
  }

  emailDispatcher.configType = "reminders";
  emailDispatcher.batchType = "CLEARANCE";

  for (const r of residents) {
    if (r.ceLink) {
      emailDispatcher.push(mapResidentToStagedClearance(r, branding));
    }
  }

  if (options.redirect) {
    goto("/admin/email-dispatcher");
  }
}

/**
 * Private mapper from record to staged email.
 */
function mapResidentToStagedEmail(
  resident: ResidentRecord,
  branding: BrandingProfile,
  template: "SOA" | "REMINDER",
  customReminders?: string
) {
  return {
    id: resident.stno,
    to: resident.email,
    recipientName: resident.name,
    template: template === "SOA" ? StatementOfAccountTemplate : (PaymentStatusTemplate as any),
    data: {
      accountName: resident.name,
      room: resident.room,
      bed: resident.bed,
      waterBase: resident.waterBase,
      waterPaid: resident.waterPaid,
      waterWaived: resident.waterWaived,
      waterBal: resident.waterBal,
      assocBase: resident.assocBase,
      assocPaid: resident.assocPaid,
      assocWaived: resident.assocWaived,
      assocBal: resident.assocBal,
      maintenanceBase: resident.maintenanceBase,
      maintenancePaid: resident.maintenancePaid,
      maintenanceWaived: resident.maintenanceWaived,
      maintenanceBal: resident.maintenanceBal,
      totalBase: resident.totalBase,
      paid: resident.paid,
      waived: resident.waived,
      bal: resident.bal,
      isFullyPaid: resident.isFullyPaid,
      reminders: customReminders || "",
      warnReservationCancellation: false,
      warnClearance: false,
      hideBedNotice: false,
      headerImageUrl: branding.emailHeaderUrl,
      replyTo: branding.replyTo
    },
    branding: branding
  };
}

/**
 * Private mapper from record to staged clearance email.
 */
function mapResidentToStagedClearance(resident: ResidentRecord, branding: BrandingProfile) {
  return {
    id: resident.stno,
    to: resident.email,
    recipientName: resident.name,
    template: ClearanceCertificateTemplate as any,
    data: {
      accountName: resident.name,
      ceFullName: resident.ceFullName,
      period: resident.period,
      ceLink: resident.ceLink,
      ceRefNo: resident.ceRefNo
    },
    branding: branding
  };
}

/**
 * Clears a resident by generating a clearance link and updating the spreadsheet.
 */
export async function clearResident(resident: ResidentRecord, issuerId: string) {
  const now = new Date();
  const dateString = now.toLocaleDateString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric"
  });

  const refNo = crypto.randomUUID();

  const publicLink = `${window.location.origin}/clearance/${refNo}`;

  await residentService.updateClearance(resident.residentId, resident.period, {
    refNo,
    dateString,
    publicLink,
    issuerId
  });

  return { refNo, dateString, publicLink };
}

/**
 * Returns a standardized status string for a resident record based on payment progress.
 */
export function getPaymentStatus(r: ResidentRecord): string {
  if (r.ceIssued && r.ceIssued !== "" && r.ceIssued !== "#N/A" && r.ceIssued !== "N/A") {
    return "CLEARED";
  }
  if (r.bal < 0) {
    return "OVERPAID";
  }
  if (r.totalBase > 0 && r.bal <= 0) {
    return "FULLY_PAID";
  }
  if (r.totalBase === 0) {
    return "NO_RECORD";
  }

  const progress = (r.paid + r.waived) / r.totalBase;
  if (progress >= 0.5) {
    return "HALF_FULLY_PAID";
  }
  if (progress > 0) {
    return "PARTIALLY_PAID";
  }
  return "NO_PAYMENT";
}

/**
 * Standardized logic for matching a resident record against payment status filters.
 */
export function matchesStatusFilter(r: ResidentRecord, filter: string): boolean {
  if (filter === "ALL" || !r) {
    return true;
  }

  const status = getPaymentStatus(r);

  switch (filter) {
    case "FULLY_PAID":
      return status === "FULLY_PAID" || status === "CLEARED" || status === "OVERPAID";
    case "HALF_FULLY_PAID":
      return status === "HALF_FULLY_PAID";
    case "PARTIALLY_PAID":
      return status === "PARTIALLY_PAID";
    case "NO_PAYMENT":
      return status === "NO_PAYMENT";
    case "CLEARED":
      return status === "CLEARED";
    case "PENDING":
      return status !== "CLEARED" && status !== "FULLY_PAID" && status !== "OVERPAID";
    default:
      return true;
  }
}

// FIXME: This should be replaced with a less hacky RBAC system in the future.
//        The CASL.js pattern is already being followed here, however.

export function canAccessFridge(accountType: string): boolean {
  const type = (accountType || "").trim().toUpperCase();
  if (
    type === AccountType.STUDENT ||
    type === AccountType.BOOTCAMP ||
    type === AccountType.TRANSIENT
  ) {
    return true;
  }
  return false;
}

export function canAccessLaundry(accountType: string): boolean {
  const type = (accountType || "").trim().toUpperCase();
  if (
    type === AccountType.STUDENT ||
    type === AccountType.BOOTCAMP ||
    type === AccountType.TRANSIENT
  ) {
    return true;
  }
  return false;
}

export function canSeeLaundryNames(accountType: string): boolean {
  const type = (accountType || "").trim().toUpperCase();
  if (type !== AccountType.TRANSIENT) {
    return true;
  }
  return false;
}

export function canAccessAchievements(accountType: string): boolean {
  const type = (accountType || "").trim().toUpperCase();
  if (
    type === AccountType.STUDENT ||
    type === AccountType.BOOTCAMP ||
    type === AccountType.ALUMNUS
  ) {
    return true;
  }
  return false;
}
export function isResidentRouteAllowed(
  urlOrHref: string,
  accountType: string,
  room?: string
): boolean {
  const type = (accountType || "").trim().toUpperCase();

  if (urlOrHref.includes("/laundry")) {
    return canAccessLaundry(type);
  }

  if (urlOrHref.includes("/fridge")) {
    return canAccessFridge(type);
  }

  if (urlOrHref.includes("/achievements") || urlOrHref.includes("/leaderboards")) {
    return canAccessAchievements(type);
  }

  const customItems = getCustomServices("resident");
  const matched = customItems.find((item) => urlOrHref.startsWith(item.url));
  if (matched && matched.isAllowed) {
    return matched.isAllowed(type, room);
  }

  return true;
}

export async function changeAccountType(
  residentId: string,
  period: string,
  newType: string
): Promise<void> {
  return residentService.changeAccountType(residentId, period, newType);
}
