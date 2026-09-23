<script lang="ts">
  import { pageState } from "$state/page-info.svelte";
  import { onMount } from "svelte";
  import { page } from "$app/state";
  import { Button } from "$ui/button";
  import {
    ArrowLeft,
    CircleX,
    ExternalLink,
    ChevronLeft,
    ChevronRight,
    TriangleAlert
  } from "@lucide/svelte";
  import ContentHeader from "$components/content/ContentHeader.svelte";
  import LoadingView from "$components/content/LoadingView.svelte";
  import ErrorView from "$components/content/ErrorView.svelte";
  import TransactionForm from "$components/forms/TransactionForm.svelte";
  import {
    fetchAdminPaymentRequests,
    declinePaymentRequest,
    approvePaymentRequest
  } from "$api/controllers/payment-request-controller";
  import { fetchResidents, fetchUsers } from "$api/controllers/resident-controller";
  import { PaymentRequestStatus, JOURNAL_COL as JOR, TransactionType } from "$lib/types";
  import { settings } from "$state/settings.svelte";
  import { toast } from "svelte-sonner";
  import { formatAmount, formatDate } from "$utils/formatters";
  import { translateMop } from "$utils/translators";
  import { Textarea } from "$ui/textarea";
  import { goto } from "$app/navigation";
  import * as Card from "$ui/card";
  import { auth } from "$state/auth.svelte";
  import { deleteUploadedImage } from "$utils/image-utils";

  let payments = $state<any[]>([]);
  let residents = $state<any[]>([]);
  let isLoading = $state(true);
  let error = $state<string | null>(null);
  let currentIndex = $state(0);
  let declineReason = $state("");
  let isProcessing = $state(false);
  let stagedForms = $state<Record<string, any>>({});

  const ids = $derived(page.url.searchParams.get("ids")?.split(",") || []);

  async function loadData() {
    isLoading = true;
    error = null;
    try {
      const [p, r, u] = await Promise.all([
        fetchAdminPaymentRequests(true),
        fetchResidents(true),
        fetchUsers(true)
      ]);

      const filtered = p.filter(
        (item) => ids.includes(item.id) && item.status === PaymentRequestStatus.PENDING
      );

      // Initialize staged forms BEFORE setting reactive payments list
      filtered.forEach((p) => {
        const resident = r.find((res) => res.residentId === p.residentId);
        const user = u.find((usr) => usr.id === p.residentId);
        stagedForms[p.id] = {
          date: p.date,
          creator: "", // deprecated
          account: "", // deprecated
          water: p.waterFee,
          assoc: p.assocFee,
          misc: p.misc,
          maintenance: p.maintenanceFee || 0,
          mop: p.mop,
          period: settings.activeTerm,
          type:
            p.type !== TransactionType.COLLECTION && p.type !== TransactionType.COLLECTION_OTHERS
              ? TransactionType.COLLECTION
              : p.type,
          notes: p.notes || "",
          notesPrivate: "",
          mopRefNo: "",
          prDateIssued: "",
          prRefNo: "",
          creatorName: auth.displayNameLastFirst || "",
          name: resident?.name || user?.displayName || "",
          stno: resident?.stno || user?.studentNo || "",
          wasAudited: false,
          receiptUrl: "",
          id: "",
          creatorId: auth.userId,
          accountId: p.residentId || user?.id || resident?.residentId || "",
          amount: p.waterFee + p.assocFee + p.misc + (p.maintenanceFee || 0),
          raw: []
        };
      });

      payments = filtered;
      residents = r;

      if (payments.length === 0) {
        error = "No pending payment requests found for the selected IDs.";
      }
    } catch (e: any) {
      error = e.message;
    } finally {
      isLoading = false;
    }
  }

  let currentPayment = $derived(payments[currentIndex]);
  let currentResident = $derived(
    currentPayment ? residents.find((r) => r.residentId === currentPayment.residentId) : null
  );

  async function handleDecline() {
    if (!currentPayment || !declineReason.trim()) return;
    const paymentId = currentPayment.id;
    isProcessing = true;
    try {
      await declinePaymentRequest(paymentId, declineReason);
      await deleteUploadedImage(currentPayment.proofLink, auth.accessToken!);
      toast.success("Payment request declined");
      declineReason = "";

      // Remove from local queue
      payments = payments.filter((p) => p.id !== paymentId);

      if (payments.length === 0) {
        goto("/admin/transactions/requests");
      } else {
        // Adjust index if we were at the end
        if (currentIndex >= payments.length) {
          currentIndex = payments.length - 1;
        }
      }
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      isProcessing = false;
    }
  }

  async function handleSaveReview(row: any[]) {
    if (!currentPayment) return;
    isProcessing = true;
    try {
      await approvePaymentRequest(currentPayment.id, {
        date: row[0] || "",
        water: parseFloat(row[3] || "0"),
        assoc: parseFloat(row[4] || "0"),
        misc: parseFloat(row[5] || "0"),
        maintenance: parseFloat(row[22] || "0"),
        mop: row[6] || "",
        period: row[7] || "",
        type: row[8] || "",
        notes: row[9] || "",
        notesPrivate: row[10] || "",
        mopRefNo: row[11] || "",
        prDateIssued: row[12] || "",
        prRefNo: row[13] || "",
        receiptUrl: row[18] || "",
        creatorId: row[20] || "",
        accountId: row[21] || ""
      });
      await deleteUploadedImage(currentPayment.proofLink, auth.accessToken!);

      toast.success("Transaction added and payment request approved");

      // Remove from local queue
      const oldIndex = currentIndex;
      payments = payments.filter((_, i) => i !== oldIndex);

      if (payments.length === 0) {
        goto("/admin/transactions/requests");
      } else {
        currentIndex = Math.min(currentIndex, payments.length - 1);
      }
    } catch (e: any) {
      toast.error(e.message);
      throw e;
    } finally {
      isProcessing = false;
    }
  }

  function handleStateChange(formData: any) {
    if (!currentPayment) return;
    stagedForms[currentPayment.id] = {
      ...stagedForms[currentPayment.id],
      date: formData.date,
      creatorId: formData.creatorId || stagedForms[currentPayment.id]?.creatorId,
      accountId: formData.accountId || stagedForms[currentPayment.id]?.accountId,
      account: formData.accountEmail,
      water: parseFloat(formData.waterFee) || 0,
      assoc: parseFloat(formData.assocFee) || 0,
      misc: parseFloat(formData.miscFee) || 0,
      maintenance: parseFloat(formData.maintenanceFee) || 0,
      mop: formData.mop,
      period: formData.period,
      type: formData.type,
      notes: formData.notes,
      notesPrivate: formData.notesPrivate,
      mopRefNo: formData.mopRefNo,
      prDateIssued: formData.prDateIssued,
      prRefNo: formData.prRefNo,
      name: formData.accountName,
      stno: formData.accountStNo
    };
  }

  onMount(() => {
    pageState.title = "Review Queue";
    loadData();
  });
</script>

<div class="mx-auto max-w-7xl space-y-3">
  <ContentHeader title="Review Queue" isTopLevel={false}>
    {#snippet tabs()}
      <div class="flex items-center gap-4">
        {#if payments.length > 0}
          <div class="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <span class="text-foreground">{currentIndex + 1}</span>
            <span>of</span>
            <span>{payments.length}</span>
          </div>
          <div class="flex gap-1">
            <Button
              variant="outline"
              size="sm"
              onclick={() => (currentIndex = Math.max(0, currentIndex - 1))}
              disabled={currentIndex === 0 || isProcessing}
              icon={ChevronLeft}
            />
            <Button
              variant="outline"
              size="sm"
              onclick={() => (currentIndex = Math.min(payments.length - 1, currentIndex + 1))}
              disabled={currentIndex === payments.length - 1 || isProcessing}
              icon={ChevronRight}
            />
          </div>
        {/if}
      </div>
    {/snippet}
  </ContentHeader>

  {#if isLoading}
    <LoadingView />
  {:else if error}
    <ErrorView {error}>
      <Button
        onclick={() => goto("/admin/transactions/requests")}
        variant="outline"
        class="mt-4"
        icon={ArrowLeft}>Back to List</Button
      >
    </ErrorView>
  {:else if currentPayment}
    <div class="grid gap-6 lg:grid-cols-3">
      <!-- Left: Request Details -->
      <div class="space-y-4 lg:col-span-1">
        <Card.Root>
          <Card.Header>
            <Card.Title>Original Request</Card.Title>
          </Card.Header>
          <Card.Content class="space-y-4">
            <div class="space-y-3">
              <div class="space-y-2">
                <div class="flex flex-col space-y-1">
                  <span class="font-medium">Resident</span>
                  <span class="">{currentResident?.name || currentPayment.residentId}</span>
                </div>
                <div class="flex flex-col space-y-1">
                  <span class="font-medium">Date</span>
                  <span class="">{formatDate(currentPayment.date)}</span>
                </div>
                <div class="flex flex-col space-y-1">
                  <span class="font-medium">Mode of Payment</span>
                  <span class="">{translateMop(currentPayment.mop)}</span>
                </div>

                {#if currentPayment.notes}
                  <div class="flex flex-col space-y-1">
                    <span class="font-medium">Resident Notes:</span>
                    <p>{currentPayment.notes}</p>
                  </div>
                {/if}

                <div class="mt-1 flex justify-between border-t pt-2 text-sm">
                  <span class="font-medium">Water Fee:</span>
                  <span>{formatAmount(currentPayment.waterFee)}</span>
                </div>
                <div class="flex justify-between text-sm">
                  <span class="font-medium">Association Fee:</span>
                  <span>{formatAmount(currentPayment.assocFee)}</span>
                </div>
                <div class="flex justify-between text-sm">
                  <span class="font-medium">Maintenance & Gas Fee:</span>
                  <span>{formatAmount(currentPayment.maintenanceFee || 0)}</span>
                </div>
                <div class="flex justify-between text-sm">
                  <span class="font-medium">Miscellaneous:</span>
                  <span>{formatAmount(currentPayment.misc)}</span>
                </div>
                <div class="mt-1 flex justify-between border-t pt-2 text-sm font-bold">
                  <span>Total:</span>
                  <span class="text-primary">
                    {formatAmount(
                      currentPayment.waterFee +
                        currentPayment.assocFee +
                        currentPayment.misc +
                        (currentPayment.maintenanceFee || 0)
                    )}
                  </span>
                </div>

                {#if currentPayment.proofLink}
                  <div class="pt-2">
                    <Button
                      variant="secondary"
                      class="flex"
                      href={currentPayment.proofLink}
                      target="_blank"
                    >
                      <ExternalLink class="h-3 w-3" /> View Proof of Payment
                    </Button>
                  </div>
                {/if}

                {#if currentPayment.proofLink?.includes("/api/image/")}
                  <div
                    class="mt-2 flex items-start gap-3 rounded-lg border border-destructive/20 bg-destructive/10 p-3"
                  >
                    <TriangleAlert class="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                    <p class="text-xs">
                      This receipt was uploaded through this instance's storage provider. Approving
                      or declining this request will <strong
                        >permanently delete the image copy</strong
                      >.
                    </p>
                  </div>
                {/if}
              </div>
            </div>
          </Card.Content>
        </Card.Root>
        <!-- Decline Action -->
        <Card.Root>
          <Card.Header>
            <Card.Title>Decline Request</Card.Title>
          </Card.Header>
          <Card.Content class="space-y-4">
            <Textarea
              placeholder="Reason for declining..."
              bind:value={declineReason}
              class="bg-background text-xs"
            />
            <Button
              variant="destructive"
              size="sm"
              class="w-full"
              onclick={handleDecline}
              isLoading={isProcessing}
              disabled={!declineReason.trim()}
              icon={CircleX}
            >
              Decline
            </Button>
          </Card.Content>
        </Card.Root>
      </div>

      <!-- Right: Processing Form -->
      <div class="lg:col-span-2">
        {#key currentPayment.id}
          <TransactionForm
            mode="add"
            hideHeader={true}
            initialData={stagedForms[currentPayment.id]}
            isSubmitting={isProcessing}
            onSave={handleSaveReview}
            onStateChange={handleStateChange}
          />
        {/key}
      </div>
    </div>
  {/if}
</div>
