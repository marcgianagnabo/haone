import { type JournalRecord, type ResidentRecord, type UserRecord, AccountType } from "$lib/types";
import { auth } from "$state/auth.svelte";

export type ResidentProfile = Pick<
  UserRecord,
  | "id"
  | "email"
  | "firstName"
  | "lastName"
  | "studentNo"
  | "college"
  | "program"
  | "tags"
  | "suffix"
  | "overrideName"
>;

export type ResidentAccount = Omit<
  ResidentRecord,
  "raw" | "ceFullName" | "notes" | "residentId" | "ledgerId" | "checkInDate"
>;

export type Transaction = Pick<
  JournalRecord,
  | "id"
  | "date"
  | "type"
  | "amount"
  | "period"
  | "mop"
  | "notes"
  | "creator"
  | "prRefNo"
  | "runningBalance"
>;

export interface OnboardingAccountEntry {
  room: string;
  bed: string;
  lastName: string;
  firstName: string;
  college: string;
  program: string;
  studentNo: string;
  accountType: string;
  isEvaluated: boolean;
  checkInDate: string;
  suffix: string;
  overrideName: string;
  declineReason?: string;
}

export interface OccupiedBed {
  room: string;
  bed: string;
}

export interface ConstantOption {
  value: string;
  label: string;
}

export interface ResidentStatus {
  /** User has previously registered in the system */
  isRegistered: boolean;
  /** User has an active account for the current term */
  hasActiveAccount: boolean;
  /** User has a pending confirmation for their account */
  waitingForConfirmation: boolean;
  /** Front-end selected term (defaults to system active term) */
  activeTerm: string;
  /** System active term */
  systemActiveTerm: string;
  /** An array of all available terms */
  allTerms: string[];
  /** An array of all MOP types */
  mopTypes: ConstantOption[];
  /** Resident's profile information */
  profile: ResidentProfile | null;
  /** Resident's account information */
  account: ResidentAccount | null;
  /** Resident's onboarding information */
  currEntry: OnboardingAccountEntry | null;
  /** An array of all transactions */
  transactions: Transaction[];
  /** An array of all occupied beds */
  occupiedBeds: OccupiedBed[];
}

import { fetchResidentStatus } from "$api/controllers/resident-controller";

class ResidentState {
  status = $state<ResidentStatus | null>(null);
  isLoading = $state(false);
  error = $state<string | null>(null);

  async refresh() {
    if (!auth.accessToken) return;
    this.isLoading = true;
    this.error = null;
    try {
      this.status = await fetchResidentStatus(undefined, true);
    } catch (e: any) {
      this.error = e.message;
    } finally {
      this.isLoading = false;
    }
  }

  forceOnboarding = $state(false);

  get needsOnboarding(): boolean {
    if (this.forceOnboarding) return true;
    if (!this.status) {
      return false;
    }
    if (this.status.currEntry?.accountType === AccountType.ALUMNUS) {
      return !this.status.isRegistered;
    }
    // Onboarded when an active account exists, OR once the registration has
    // been approved (evaluated) with a bed assigned. This keeps an approved
    // resident off the onboarding form even before their account row exists.
    const s = this.status;
    const hasActiveAccount = !!(s.hasActiveAccount && s.account?.bed);
    const hasApprovedEntry = !!(s.currEntry?.isEvaluated && s.currEntry?.bed);
    return !(s.isRegistered && (hasActiveAccount || hasApprovedEntry));
  }
}

export const residentState = new ResidentState();
