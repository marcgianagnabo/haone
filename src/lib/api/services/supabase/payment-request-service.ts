import type {
  JournalRecord,
  PaginatedResponse,
  PaginationOptions,
  PaymentRequestRecord
} from "$lib/types";
import { PaymentRequestStatus } from "$lib/types";
import { auth } from "$state/auth.svelte";
import { deleteUploadedImage } from "$utils/image-utils";
import { isUuid, parseDbDate } from "$utils/parsers";
import {
  assertSupabaseFound,
  fetchAllSupabaseRows,
  handleSupabaseError,
  resolveSupabaseUserId,
  supabase
} from "../common";
import type { PaymentRequestServiceInterface } from "../interfaces/payment-request-service.interface";

function emptyResult(
  options?: PaginationOptions
): PaymentRequestRecord[] | PaginatedResponse<PaymentRequestRecord> {
  if (options?.page && options?.pageSize) {
    return {
      items: [],
      totalCount: 0,
      page: options.page,
      pageSize: options.pageSize,
      totalPages: 0
    };
  }
  return [];
}

export const supabasePaymentRequestService: PaymentRequestServiceInterface = {
  async fetchPaymentRequests(
    residentId?: string,
    options?: PaginationOptions,
    _bypassCache?: boolean
  ): Promise<PaymentRequestRecord[] | PaginatedResponse<PaymentRequestRecord>> {
    if (!supabase) {
      return [];
    }

    if (residentId && !isUuid(residentId)) {
      // A non-UUID id can never match; Sheets' equality filter yields nothing.
      return emptyResult(options);
    }

    const isPaginated = !!(options?.page && options?.pageSize);
    let data: any[] = [];
    let count = 0;

    if (isPaginated) {
      let query = supabase.from("payment_requests").select("*", { count: "exact" });
      if (residentId) {
        query = query.eq("resident_id", residentId);
      }
      query = query.order("created_at", { ascending: true }).order("id", { ascending: true });
      const start = (options!.page! - 1) * options!.pageSize!;
      const end = start + options!.pageSize! - 1;
      const { data: rows, count: total, error } = await query.range(start, end);
      if (error) {
        handleSupabaseError(error);
      }
      data = rows || [];
      count = total || 0;
    } else {
      const sb = supabase;
      data = await fetchAllSupabaseRows(() => {
        let query = sb.from("payment_requests").select("*");
        if (residentId) {
          query = query.eq("resident_id", residentId);
        }
        return query.order("created_at", { ascending: true }).order("id", { ascending: true });
      });
    }

    const usersRes = await supabase.from("users_view").select("id, display_name");
    if (usersRes.error) {
      handleSupabaseError(usersRes.error);
    }

    const userMap = new Map<string, string>();
    (usersRes.data || []).forEach((u: any) => {
      if (u.id) {
        userMap.set(u.id, u.display_name || "");
      }
    });

    const items: PaymentRequestRecord[] = data.map((row: any) => ({
      id: row.id,
      residentId: row.resident_id,
      date: row.date,
      waterFee: row.water_fee ?? 0,
      assocFee: row.assoc_fee ?? 0,
      misc: row.misc ?? 0,
      maintenanceFee: row.maintenance_fee ?? 0,
      mop: row.mop || "",
      type: row.type || "",
      proofLink: row.proof_link || "",
      status: (row.status || PaymentRequestStatus.PENDING).trim().toUpperCase(),
      notes: row.notes || "",
      statusReason: row.status_reason || "",
      name: userMap.get(row.resident_id) || "",
      raw: row
    }));

    if (isPaginated) {
      return {
        items,
        totalCount: count,
        page: options!.page!,
        pageSize: options!.pageSize!,
        totalPages: Math.ceil(count / options!.pageSize!)
      };
    }

    return items;
  },

  async addPaymentRequest(data: Partial<PaymentRequestRecord>): Promise<void> {
    if (!supabase) {
      return;
    }
    const { error } = await supabase.from("payment_requests").insert({
      id: data.id || crypto.randomUUID(),
      resident_id: data.residentId,
      date: data.date,
      water_fee: data.waterFee ?? 0,
      assoc_fee: data.assocFee ?? 0,
      misc: data.misc ?? 0,
      maintenance_fee: data.maintenanceFee ?? 0,
      mop: data.mop,
      type: data.type,
      proof_link: data.proofLink,
      status: data.status || PaymentRequestStatus.PENDING,
      notes: data.notes,
      status_reason: data.statusReason
    });
    if (error) {
      handleSupabaseError(error);
    }
  },

  async approvePaymentRequest(
    paymentId: string,
    journalData: Partial<JournalRecord>
  ): Promise<void> {
    if (!supabase) {
      return;
    }

    // Conditional update: only a still-PENDING request can be approved. This
    // makes double-approval (two admins / double-click) a no-op at the DB level.
    const { data: approved, error } = await supabase
      .from("payment_requests")
      .update({ status: PaymentRequestStatus.APPROVED })
      .eq("id", paymentId)
      .eq("status", PaymentRequestStatus.PENDING)
      .select("id");
    if (error) {
      handleSupabaseError(error);
    }
    assertSupabaseFound(approved, "Payment record not found or is no longer pending");

    const creatorId = await resolveSupabaseUserId(
      journalData.creatorId || journalData.creator,
      auth.user?.email
    );
    const accountId = await resolveSupabaseUserId(journalData.accountId || journalData.account);

    const { error: jError } = await supabase.from("journal").insert({
      id: crypto.randomUUID(),
      date: journalData.date,
      creator_id: creatorId,
      account_id: accountId,
      water: journalData.water ?? 0,
      assoc: journalData.assoc ?? 0,
      misc: journalData.misc ?? 0,
      maintenance: journalData.maintenance ?? 0,
      mop: journalData.mop,
      period: journalData.period,
      type: journalData.type,
      notes: journalData.notes,
      notes_private: journalData.notesPrivate,
      mop_ref_no: journalData.mopRefNo,
      pr_date_issued: parseDbDate(journalData.prDateIssued),
      pr_ref_no: journalData.prRefNo,
      was_audited: journalData.wasAudited ?? false,
      receipt_url: journalData.receiptUrl
    });

    if (jError) {
      // Best-effort compensation so the request is not stuck APPROVED with no
      // journal entry.
      await supabase
        .from("payment_requests")
        .update({ status: PaymentRequestStatus.PENDING })
        .eq("id", paymentId);
      handleSupabaseError(jError);
    }
  },

  async declinePaymentRequest(paymentId: string, reason: string): Promise<void> {
    if (!supabase) {
      return;
    }
    const { data, error } = await supabase
      .from("payment_requests")
      .update({
        status: PaymentRequestStatus.DECLINED,
        status_reason: reason
      })
      .eq("id", paymentId)
      .select("id");
    if (error) {
      handleSupabaseError(error);
    }
    assertSupabaseFound(data, "Payment record not found");
  },

  async cancelPaymentRequest(paymentId: string): Promise<void> {
    if (!supabase) {
      return;
    }
    // Conditional update: only a still-PENDING request can be cancelled. If it
    // was already approved/declined on the admin side, this is a no-op at the DB
    // level even if the resident's page still shows it as pending.
    const { data, error } = await supabase
      .from("payment_requests")
      .update({ status: PaymentRequestStatus.CANCELLED })
      .eq("id", paymentId)
      .eq("status", PaymentRequestStatus.PENDING)
      .select("id, proof_link");
    if (error) {
      handleSupabaseError(error);
    }
    assertSupabaseFound(data, "Payment request not found or is no longer pending");

    // The resident cancelled an uploaded proof, so remove the stored image too.
    const proofLink = data?.[0]?.proof_link;
    if (proofLink && auth.accessToken) {
      await deleteUploadedImage(proofLink, auth.accessToken);
    }
  }
};
