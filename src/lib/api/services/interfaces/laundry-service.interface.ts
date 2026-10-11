import type { LaundryRecord, PaginatedResponse, PaginationOptions } from "$lib/types";

export interface LaundryBookerName {
  name: string;
  room: string;
}

export interface LaundryServiceInterface {
  fetchReservations(
    residentId?: string,
    options?: PaginationOptions,
    bypassCache?: boolean
  ): Promise<LaundryRecord[] | PaginatedResponse<LaundryRecord>>;

  /**
   * Resident-visible booker names + rooms keyed by resident id. Supabase
   * reads the RLS-safe get_laundry_booker_names() RPC; Sheets returns an
   * empty map because the resident GET already carries displayName/room per
   * row for non-transients. Tolerates a missing RPC (renders "Reserved").
   */
  fetchBookerNames(): Promise<Map<string, LaundryBookerName>>;

  addReservation(data: Partial<LaundryRecord>): Promise<void>;

  addReservationsBatch(entries: Partial<LaundryRecord>[]): Promise<void>;

  cancelReservation(id: string, reason: string): Promise<void>;
}
