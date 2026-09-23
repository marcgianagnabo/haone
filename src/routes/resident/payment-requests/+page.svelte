<script lang="ts">
  import { onMount } from "svelte";
  import { Button } from "$ui/button";
  import { Search, Plus, ReceiptText, Wallet } from "@lucide/svelte";
  import LoadingView from "$components/content/LoadingView.svelte";
  import ErrorView from "$components/content/ErrorView.svelte";
  import ContentHeader from "$components/content/ContentHeader.svelte";
  import FilterDrawer from "$components/content/FilterDrawer.svelte";
  import EmptyView from "$components/content/EmptyView.svelte";
  import {
    fetchPaymentRequests,
    cancelPaymentRequest
  } from "$api/controllers/payment-request-controller";
  import { type PaymentRequestRecord, PaymentRequestStatus } from "$lib/types";
  import { toast } from "svelte-sonner";
  import { pageState } from "$state/page-info.svelte";
  import DataTable from "$ui/data-table/data-table.svelte";
  import { columns } from "./columns";
  import * as InputGroup from "$ui/input-group";
  import { Label } from "$ui/label";
  import { Combobox } from "$ui/combobox";
  import { globalDialog } from "$state/dialog.svelte";

  let payments = $state<PaymentRequestRecord[]>([]);
  let isLoading = $state(true);
  let error = $state<string | null>(null);
  let discardRequestId = $state<string | null>(null);
  let currentResidentId = $state("");
  let searchQuery = $state("");
  let statusFilter = $state<string>("");

  const statusOptions = [
    { value: "", label: "All Status" },
    { value: PaymentRequestStatus.PENDING, label: "Pending" },
    { value: PaymentRequestStatus.APPROVED, label: "Approved" },
    { value: PaymentRequestStatus.DECLINED, label: "Declined" },
    { value: PaymentRequestStatus.CANCELLED, label: "Cancelled" }
  ];

  async function loadData(bypassCache = false) {
    isLoading = true;
    error = null;
    try {
      const [pmtResult] = await Promise.all([fetchPaymentRequests(bypassCache)]);

      if (Array.isArray(pmtResult)) {
        payments = pmtResult;
      } else {
        payments = pmtResult.requests;
        currentResidentId = pmtResult.currentResidentId;
      }
    } catch (e: any) {
      error = e.message;
    } finally {
      isLoading = false;
    }
  }

  function confirmDiscard(id: string) {
    discardRequestId = id;
    globalDialog.confirm(
      "Cancel transaction?",
      "Do you want to cancel this transaction? The payment proof will be deleted and the request cannot be restored.",
      undefined,
      async () => {
        if (!discardRequestId) {
          return;
        }
        try {
          await cancelPaymentRequest(discardRequestId);
          toast.success("Payment request cancelled.");
          discardRequestId = null;
          await loadData();
        } catch (e: any) {
          toast.error(e.message);
        }
      },
      undefined,
      {
        accept: "Yes, cancel it",
        cancel: "Go back"
      }
    );
  }

  onMount(() => {
    pageState.title = "Payment Requests";
    loadData();
  });

  let filteredPayments = $derived.by(() => {
    const s = searchQuery.toLowerCase().trim();
    return payments.filter((p) => {
      const matchesSearch =
        !s || (p.mop || "").toLowerCase().includes(s) || (p.notes || "").toLowerCase().includes(s);
      const matchesStatus = !statusFilter || p.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  });
</script>

<div class="mx-auto max-w-7xl space-y-3">
  <ContentHeader
    title="Payment Requests"
    isTopLevel={true}
    onRefresh={() => loadData(true)}
    isRefreshing={isLoading}
    actions={[{ label: "Add", href: "/resident/payment-requests/add", icon: Plus }]}
    hasFilter={true}
  />

  {#if isLoading}
    <LoadingView />
  {:else if error}
    <ErrorView {error}>
      <Button onclick={() => loadData()} class="mt-4">Retry</Button>
    </ErrorView>
  {:else}
    <FilterDrawer activeCount={Number(searchQuery !== "") + Number(statusFilter !== "")}>
      <div class="grid gap-4 lg:grid-cols-12">
        <div class="space-y-1 lg:col-span-8">
          <Label>Search</Label>
          <InputGroup.Root class="h-9">
            <InputGroup.Input bind:value={searchQuery} placeholder="Search by MOP or notes…" />
            <InputGroup.Addon>
              <Search />
            </InputGroup.Addon>
          </InputGroup.Root>
        </div>

        <div class="space-y-1 lg:col-span-4">
          <Label>Status</Label>
          <Combobox
            bind:value={statusFilter}
            options={statusOptions}
            placeholder="Select status..."
            class="h-9"
          />
        </div>
      </div>
    </FilterDrawer>

    <div class="space-y-4">
      {#if filteredPayments.length > 0}
        <DataTable
          data={filteredPayments}
          {columns}
          rowId="id"
          meta={{
            onCancel: confirmDiscard
          }}
        />
      {:else}
        <EmptyView
          title="No payment requests found."
          description={searchQuery || statusFilter
            ? "Try adjusting your filters or search query."
            : "Any payments you submit will appear here."}
        >
          {#snippet icon()}
            {#if searchQuery || statusFilter}
              <Wallet class="h-8 w-8 text-muted-foreground" />
            {:else}
              <ReceiptText class="h-8 w-8 text-muted-foreground" />
            {/if}
          {/snippet}
        </EmptyView>
      {/if}
    </div>
  {/if}
</div>
