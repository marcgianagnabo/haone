import type { ResidentRecord, UserRecord } from "$lib/types";

export interface ResidentServiceInterface {
  fetchResidents(bypassCache?: boolean, term?: string): Promise<ResidentRecord[]>;
  fetchResidentStatus(term?: string, bypassCache?: boolean): Promise<any>;
  changeAccountType(residentId: string, period: string, newType: string): Promise<void>;
  fetchUsers(bypassCache?: boolean): Promise<UserRecord[]>;
  updateUser(userId: string, data: Partial<UserRecord>): Promise<void>;
  addUser(data: Partial<UserRecord>): Promise<void>;
  deleteUser(userId: string): Promise<void>;
  updateClearance(
    residentId: string,
    period: string,
    data: { refNo: string; dateString: string; publicLink: string; issuerId: string }
  ): Promise<void>;
  registerResident(data: Record<string, any>): Promise<void>;
  isStudentNoTaken(studentNo: string): Promise<boolean>;
}
