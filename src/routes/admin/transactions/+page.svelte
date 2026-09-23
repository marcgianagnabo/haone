<script lang="ts">
  import { pageState } from "$state/page-info.svelte";
  import { onMount } from "svelte";
  import { goto } from "$app/navigation";
  import { TableSync } from "$ui/data-table/table-sync.svelte";
  import { settings } from "$state/settings.svelte";
  import { fetchJournalEntries, batchAuditEntries } from "$api/controllers/journal-controller";
  import { fetchMopTypes } from "$api/controllers/constants-controller";
  import { parseDateWeight } from "$utils/parsers";
  import { Combobox } from "$ui/combobox";
  import { Button } from "$ui/button";
  import * as InputGroup from "$ui/input-group";
  import { Label } from "$ui/label";
  import FilterDrawer from "$components/content/FilterDrawer.svelte";
  import { RefreshCcw, ListFilter, Search, ShieldCheck, Plus } from "@lucide/svelte";
  import ContentHeader from "$components/content/ContentHeader.svelte";
  import EmptyView from "$components/content/EmptyView.svelte";
  import LoadingView from "$components/content/LoadingView.svelte";
  import ErrorView from "$components/content/ErrorView.svelte";
  import { columns } from "./columns";
  import DataTable from "$ui/data-table/data-table.svelte";
  import AdminTransactionsTabs from "$components/tabs/AdminTransactionsTabs.svelte";
  import { type JournalRecord, TRANSACTION_TYPE_OPTIONS, TransactionType } from "$lib/types";
  import { toast } from "svelte-sonner";
  import { globalDialog } from "$state/dialog.svelte";

  let journal = $state<JournalRecord[]>([]);
  let mopTypes = $state<{ value: string; label: string }[]>([]);
  let isLoading = $state(false);
  let error = $state<string | null>(null);
  let selectedIds = $state<Set<string>>(new Set());

  // Filters
  const tableSync = new TableSync({
    initialFilters: { search: "", type: "ALL", mop: "ALL", status: "UNAUDITED" },
    paramMap: { search: "q", type: "type", mop: "mop", status: "status" },
    searchKey: "search"
  });

  async function loadData(bypassCache = false) {
    isLoading = true;
    error = null;
    selectedIds = new Set();

    try {
      const [entries, mops] = await Promise.all([
        fetchJournalEntries(undefined, undefined, bypassCache),
        fetchMopTypes(bypassCache)
      ]);

      mopTypes = [{ value: "", label: "N/A" }, ...mops];

      const journals = Array.isArray(entries) ? entries : entries.items;

      const mappedJournal: JournalRecord[] = journals
        .map((res) => ({
          ...res,
          dateWeight: parseDateWeight(res.date)
        }))
        .filter((r) => !settings.currentTerm || r.period === settings.currentTerm)
        .sort(
          (a, b) =>
            (b.dateWeight ?? 0) - (a.dateWeight ?? 0) || (b.ledgerIndex ?? 0) - (a.ledgerIndex ?? 0)
        );

      let globalBalance = 0;
      for (let i = mappedJournal.length - 1; i >= 0; i--) {
        if (mappedJournal[i].type !== TransactionType.WAIVED) {
          globalBalance += mappedJournal[i].amount;
        }
        mappedJournal[i].runningBalance = globalBalance;
      }

      journal = mappedJournal;
    } catch (e: any) {
      error = e.message;
    } finally {
      isLoading = false;
    }
  }

  async function confirmBatchAudit() {
    const auditedMap = new Map(journal.map((r) => [r.id, r.wasAudited === true]));
    const pendingIds = Array.from(selectedIds).filter((id) => !auditedMap.get(id));
    const count = pendingIds.length;
    if (count === 0) {
      toast.info("Selected transactions are already audited.");
      return;
    }

    const title = count === 1 ? "Mark transaction as audited?" : "Mark transactions as audited?";

    const description =
      count === 1
        ? "This transaction will be locked and cannot be edited or reverted."
        : `These ${count} transactions will be locked and cannot be edited or reverted.`;

    globalDialog.confirm(
      title,
      description,
      undefined,
      async () => {
        try {
          await batchAuditEntries(pendingIds);
          toast.success(
            count === 1
              ? "Transaction marked as audited."
              : `${count} transactions marked as audited.`
          );
          selectedIds = new Set();
          await loadData(true);
        } catch (e: any) {
          error = `Audit update failed: ${e.message}`;
          toast.error(error);
        }
      },
      undefined,
      {
        accept: "Mark audited",
        cancel: "Cancel"
      }
    );
  }

  onMount(() => {
    pageState.title = "Transactions";
  });

  $effect(() => {
    settings.currentTerm;
    loadData();
  });

  const transactionOptions = $derived([
    { value: "ALL", label: "All Types" },
    ...TRANSACTION_TYPE_OPTIONS
  ]);
  const mopOptions = $derived([{ value: "ALL", label: "All Methods" }, ...mopTypes]);
  const statusOptions = $derived([
    { value: "UNAUDITED", label: "Unaudited only" },
    { value: "AUDITED", label: "Audited only" },
    { value: "ALL_STATUSES", label: "All Statuses" }
  ]);

  const filteredJournal = $derived.by(() => {
    return journal
      .filter((r) => {
        const search = tableSync.filters!.search.toLowerCase();
        return (
          r.name?.toLowerCase().includes(search) ||
          r.account?.toLowerCase().includes(search) ||
          r.notes?.toLowerCase().includes(search) ||
          r.mopRefNo?.toLowerCase().includes(search)
        );
      })
      .filter((r) => tableSync.filters!.type === "ALL" || r.type === tableSync.filters!.type)
      .filter((r) => tableSync.filters!.mop === "ALL" || r.mop === tableSync.filters!.mop)
      .filter((r) => {
        const status = tableSync.filters!.status;
        if (status === "ALL_STATUSES") {
          return true;
        }
        return status === "AUDITED" ? r.wasAudited === true : !r.wasAudited;
      });
  });

  function resetFilters() {
    tableSync.reset();
  }
</script>

<div class="mx-auto max-w-7xl space-y-3">
  <ContentHeader
    title="Transactions"
    isTopLevel={true}
    onRefresh={() => loadData(true)}
    isRefreshing={isLoading}
    actions={[{ label: "Add", href: "/admin/transactions/add", icon: Plus }]}
    hasFilter={true}
  >
    {#snippet tabs()}
      <AdminTransactionsTabs active="all" />
    {/snippet}
  </ContentHeader>

  {#if isLoading}
    <LoadingView />
  {:else if error}
    <ErrorView {error}>
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
      activeCount={Number(tableSync.filters!.search !== "") +
        Number(tableSync.filters!.type !== "ALL") +
        Number(tableSync.filters!.mop !== "ALL") +
        Number(tableSync.filters!.status !== "UNAUDITED")}
      onClear={resetFilters}
    >
      <div class="grid gap-2 lg:grid-cols-12">
        <div class="space-y-1 lg:col-span-6">
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

        <div class="space-y-1 lg:col-span-2">
          <Label>Transaction Type</Label>
          <Combobox bind:value={tableSync.filters!.type} options={transactionOptions} class="h-9" />
        </div>

        <div class="space-y-1 lg:col-span-2">
          <Label>Payment Processor</Label>
          <Combobox bind:value={tableSync.filters!.mop} options={mopOptions} class="h-9" />
        </div>

        <div class="space-y-1 lg:col-span-2">
          <Label>Status</Label>
          <Combobox bind:value={tableSync.filters!.status} options={statusOptions} class="h-9" />
        </div>
      </div>
    </FilterDrawer>

    {#if filteredJournal.length > 0}
      <DataTable
        data={filteredJournal}
        {columns}
        pagination={tableSync.pagination}
        onPaginationChange={(p) => (tableSync.pagination = p)}
        onRowClick={(r) => goto(`/admin/transactions/${r.id}`)}
        onSelectionChange={(ids) => (selectedIds = ids)}
        meta={{ TRANSACTION_TYPE_OPTIONS }}
        rowId="id"
        enableSelection
        sorting={[{ id: "date", desc: true }]}
      >
        {#snippet actions()}
          <Button size="sm" onclick={confirmBatchAudit} icon={ShieldCheck}>Mark as Audited</Button>
        {/snippet}
      </DataTable>
    {:else}
      <EmptyView>
        {#snippet icon()}
          <ListFilter class="h-8 w-8 text-muted-foreground" />
        {/snippet}
      </EmptyView>
    {/if}
  {/if}
</div>
