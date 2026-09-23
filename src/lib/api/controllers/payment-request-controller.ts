import { paymentRequestService } from "$api/services/payment-request-service";
import type { PaymentRequestRecord } from "$lib/types";
import { getSignedInUserId } from "./resident-controller";

export async function fetchPaymentRequests(bypassCache = false): Promise<{
  requests: PaymentRequestRecord[];
  currentResidentId: string;
}> {
  const currentResidentId = await getSignedInUserId();
  const res = await paymentRequestService.fetchPaymentRequests(
    currentResidentId,
    undefined,
    bypassCache
  );
  const list = Array.isArray(res) ? res : res.items;
  return {
    requests: list,
    currentResidentId
  };
}

export async function addPaymentRequest(data: Omit<PaymentRequestRecord, "raw">) {
  return await paymentRequestService.addPaymentRequest(data);
}

export async function cancelPaymentRequest(paymentId: string) {
  return await paymentRequestService.cancelPaymentRequest(paymentId);
}

export async function fetchAdminPaymentRequests(
  bypassCache = false
): Promise<PaymentRequestRecord[]> {
  const res = await paymentRequestService.fetchPaymentRequests(undefined, undefined, bypassCache);
  return Array.isArray(res) ? res : res.items;
}

export async function approvePaymentRequest(
  paymentId: string,
  journalData: {
    date: string;
    water: number;
    assoc: number;
    misc: number;
    maintenance?: number;
    mop: string;
    period: string;
    type: string;
    notes: string;
    notesPrivate?: string;
    mopRefNo: string;
    prDateIssued?: string;
    prRefNo?: string;
    receiptUrl?: string;
    creatorId?: string;
    accountId?: string;
  }
) {
  await paymentRequestService.approvePaymentRequest(paymentId, {
    date: journalData.date,
    water: journalData.water,
    assoc: journalData.assoc,
    misc: journalData.misc,
    maintenance: journalData.maintenance,
    mop: journalData.mop,
    period: journalData.period,
    type: journalData.type,
    notes: journalData.notes,
    notesPrivate: journalData.notesPrivate,
    mopRefNo: journalData.mopRefNo,
    prDateIssued: journalData.prDateIssued,
    prRefNo: journalData.prRefNo,
    receiptUrl: journalData.receiptUrl,
    creatorId: journalData.creatorId,
    accountId: journalData.accountId
  });
}

export async function declinePaymentRequest(paymentId: string, reason: string) {
  await paymentRequestService.declinePaymentRequest(paymentId, reason);
}
