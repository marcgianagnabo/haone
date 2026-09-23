<script lang="ts">
  import { pageState } from "$state/page-info.svelte";
  import { onMount } from "svelte";
  import { emailDispatcher } from "$state/dispatcher.svelte";
  import { AcknowledgmentTemplate } from "$templates/acknowledgment";
  import { goto } from "$app/navigation";
  import { TableSync } from "$ui/data-table/table-sync.svelte";
  import { brandingState } from "$state/branding.svelte";
  import { settings } from "$state/settings.svelte";
  import {
    fetchJournalEntries,
    updateJournalReceiptInfo
  } from "$api/controllers/journal-controller";
  import { parseDateWeight } from "$utils/parsers";
  import * as InputGroup from "$ui/input-group";
  import { Label } from "$ui/label/index.js";
  import { Button } from "$ui/button/index.js";
  import { Search, RefreshCcw, FileCheck, CircleCheckBig } from "@lucide/svelte";
  import ContentHeader from "$components/content/ContentHeader.svelte";
  import FilterDrawer from "$components/content/FilterDrawer.svelte";
  import EmptyView from "$components/content/EmptyView.svelte";
  import LoadingView from "$components/content/LoadingView.svelte";
  import ErrorView from "$components/content/ErrorView.svelte";
  import DataTable from "$ui/data-table/data-table.svelte";
  import AdminTransactionsTabs from "$components/tabs/AdminTransactionsTabs.svelte";
  import { columns } from "./columns";
  import type { ReceiptData } from "$lib/types";

  import { type JournalRecord } from "$lib/types";

  let queue = $state<JournalRecord[]>([]);
  let selectedIndices = $state<Set<string>>(new Set());
  let isLoading = $state(false);
  let error = $state<string | null>(null);

  const tableSync = new TableSync({
    initialFilters: { search: "" },
    paramMap: { search: "q" },
    searchKey: "search"
  });

  const filteredQueue = $derived.by(() => {
    return queue.filter((r) => {
      const search = tableSync.filters!.search.toLowerCase();
      return (
        r.name?.toLowerCase().includes(search) ||
        r.account?.toLowerCase().includes(search) ||
        r.notes?.toLowerCase().includes(search) ||
        r.mopRefNo?.toLowerCase().includes(search)
      );
    });
  });

  async function loadData(bypassCache = false) {
    isLoading = true;
    error = null;
    selectedIndices = new Set();

    try {
      const [entries] = await Promise.all([fetchJournalEntries(undefined, undefined, bypassCache)]);

      const journals = Array.isArray(entries) ? entries : entries.items;

      queue = journals
        .map((journal) => ({
          ...journal,
          dateWeight: parseDateWeight(journal.date)
        }))
        .filter((r) => {
          return (
            r.period === settings.currentTerm &&
            (!r.prDateIssued || r.prDateIssued === "#N/A") &&
            r.prRefNo !== "N/A" &&
            r.prRefNo !== "#N/A"
          );
        });
    } catch (e: any) {
      error = e.message;
    } finally {
      isLoading = false;
    }
  }

  onMount(() => {
    pageState.title = "Pending Receipts";
  });

  $effect(() => {
    settings.currentTerm;
    loadData();
  });

  async function prepareDispatch() {
    if (selectedIndices.size === 0) {
      return;
    }
    const stagedEmails = [];

    const selectedRows = queue.filter((item) => selectedIndices.has(item.id!.toString()));
    const branding = brandingState.profile;

    for (const record of selectedRows) {
      const recipient = (record.account || "").trim();
      if (!recipient || !recipient.includes("@")) continue;

      const prRefNo = record.prRefNo || crypto.randomUUID();
      const dateIssued = record.prDateIssued || new Date().toISOString().split("T")[0];

      const receipt: ReceiptData = {
        dateIssued,
        paymentDate: record.date,
        processor: record.mop,
        referenceNumber: record.mopRefNo || "N/A",
        period: record.period,
        seriesNumber: prRefNo,
        receivedFrom: record.name || "N/A",
        receivedBy: record.creatorName || "N/A",
        notes: record.notes,
        transactionType: record.type,
        branding: brandingState.selectedKey,
        stno: record.stno.toString(),
        items: getActiveItems(record)
      };

      const url = `${window.location.origin}/receipt/${record.id}`;

      stagedEmails.push({
        id: record.id.toString(),
        to: recipient,
        recipientName: receipt.receivedFrom,
        template: AcknowledgmentTemplate as any,
        data: {
          accountFullName: receipt.receivedFrom,
          date: receipt.paymentDate,
          type: receipt.transactionType,
          receiptUrl: url,
          seriesNumber: receipt.seriesNumber,
          items: receipt.items
        },
        branding: branding,
        onSuccess: async () => {
          await updateJournalReceiptInfo(record.id, dateIssued, prRefNo, url);
        }
      });
    }

    emailDispatcher.batchType = "ACKNOWLEDGMENT";
    emailDispatcher.pushBatch(stagedEmails);
    goto("/admin/email-dispatcher");
  }

  function getActiveItems(r: JournalRecord) {
    return [
      { name: "Water Fee", amount: r.water },
      { name: "Association Fee", amount: r.assoc },
      { name: "Maintenance & Gas Fee", amount: r.maintenance || 0 },
      { name: "Miscellaneous", amount: r.misc }
    ].filter((i) => i.amount !== 0);
  }
</script>

<div class="mx-auto max-w-7xl space-y-3">
  <ContentHeader
    title="Transactions"
    isTopLevel={true}
    onRefresh={() => loadData(true)}
    isRefreshing={isLoading}
    hasFilter={true}
  >
    {#snippet tabs()}
      <AdminTransactionsTabs active="receipts" />
    {/snippet}
  </ContentHeader>

  {#if isLoading && queue.length === 0}
    <LoadingView />
  {:else if error}
    <ErrorView {error} class="mb-3">
      <Button
        variant="outline"
        size="sm"
        class="mt-2"
        onclick={() => loadData()}
        {isLoading}
        icon={RefreshCcw}>Try Again</Button
      >
    </ErrorView>
  {:else}
    <FilterDrawer
      activeCount={Number(tableSync.filters!.search !== "")}
      onClear={() => tableSync.reset()}
    >
      <div class="mb-4 grid gap-2 lg:grid-cols-9">
        <div class="space-y-1 lg:col-span-9">
          <Label>Search</Label>
          <InputGroup.Root class="h-9 text-sm">
            <InputGroup.Input
              bind:value={tableSync.filters!.search}
              placeholder="Search by name, account, or notes…"
            />
            <InputGroup.Addon>
              <Search />
            </InputGroup.Addon>
          </InputGroup.Root>
        </div>
      </div>
    </FilterDrawer>

    {#if filteredQueue.length > 0}
      <DataTable
        data={filteredQueue}
        {columns}
        pagination={tableSync.pagination}
        onPaginationChange={(p) => (tableSync.pagination = p)}
        onRowClick={(r) => goto(`/admin/transactions/${r.id}`)}
        onSelectionChange={(ids) => (selectedIndices = ids)}
        rowId="id"
        enableSelection
        sorting={[{ id: "date", desc: true }]}
      >
        {#snippet actions()}
          <Button size="sm" onclick={prepareDispatch} {isLoading} icon={FileCheck}>Settle</Button>
        {/snippet}
      </DataTable>
    {:else}
      <EmptyView title="No pending entries.">
        {#snippet icon()}
          <CircleCheckBig class="h-8 w-8 text-muted-foreground" />
        {/snippet}
      </EmptyView>
    {/if}
  {/if}
</div>
