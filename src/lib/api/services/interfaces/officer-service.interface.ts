import type { OfficerRecord } from "$lib/types";

export interface OfficerServiceInterface {
  fetchOfficers(bypassCache?: boolean): Promise<OfficerRecord[]>;

  addOfficer(data: Partial<OfficerRecord>): Promise<void>;

  updateOfficer(id: string, data: Partial<OfficerRecord>): Promise<void>;

  deleteOfficer(id: string): Promise<void>;

  /**
   * Best-effort auto-fill of the Gmail photo for officer rows matching the
   * login email. Never touches the admin-managed photo override. Resolves
   * silently when nothing matches or the session may not write (RLS).
   */
  fillAutoPhoto(email: string, photoUrl: string): Promise<void>;
}
