<script lang="ts">
  import { pageState } from "$state/page-info.svelte";
  import { onMount } from "svelte";
  import { brandingState } from "$state/branding.svelte";
  import { settings } from "$state/settings.svelte";
  import { type ResidentRecord as Resident } from "$lib/types";
  import {
    fetchResidents,
    stageStatusEmailBatch,
    stageClearanceEmailBatch,
    matchesStatusFilter,
    stageSoaEmailBatch as stageStatementOfAccountEmailBatch
  } from "$api/controllers/resident-controller";
  import { pluralize } from "$utils/formatters";
  import { goto } from "$app/navigation";
  import { TableSync } from "$ui/data-table/table-sync.svelte";
  import { Combobox } from "$ui/combobox";
  import { globalDialog } from "$state/dialog.svelte";

  import { Button } from "$ui/button";
  import * as InputGroup from "$ui/input-group";
  import { Label } from "$ui/label";
  import FilterDrawer from "$components/content/FilterDrawer.svelte";
  import {
    RefreshCcw,
    Users,
    Search,
    Mail,
    ChevronDown,
    FileCheck,
    ShieldCheck,
    Trophy,
    DownloadIcon
  } from "@lucide/svelte";
  import * as Tooltip from "$ui/tooltip";
  import * as DropdownMenu from "$ui/dropdown-menu";
  import ContentHeader from "$components/content/ContentHeader.svelte";
  import EmptyView from "$components/content/EmptyView.svelte";
  import LoadingView from "$components/content/LoadingView.svelte";
  import ErrorView from "$components/content/ErrorView.svelte";
  import { columns } from "./columns";
  import DataTable from "$ui/data-table/data-table.svelte";
  import ClearanceDialog from "$components/forms/ClearanceDialog.svelte";
  import AwardDialog from "$components/forms/AwardDialog.svelte";
  import AdminResidentsTabs from "$components/tabs/AdminResidentsTabs.svelte";
  import { features } from "$state/features.svelte";

  let residents = $state<Resident[]>([]);
  let isLoading = $state(false);
  let error = $state<string | null>(null);
  const tableSync = new TableSync({
    initialFilters: { search: "", room: "ALL", status: "ALL" },
    paramMap: { search: "q", room: "room", status: "status" },
    searchKey: "search"
  });

  // Alias for readability in existing code or keep as tableSync.filters/pagination
  let pagination = $derived.by(() => tableSync.pagination);
  let selectedIndices = $state<Set<string>>(new Set()); // Uses stno as key
  let customReminders = $state("");

  async function loadData(bypassCache = false) {
    isLoading = true;
    error = null;
    selectedIndices = new Set();
    try {
      residents = await fetchResidents(bypassCache, settings.currentTerm);
    } catch (e: any) {
      error = e.message;
    } finally {
      isLoading = false;
    }
  }

  onMount(() => {
    pageState.title = "Residents";
  });

  $effect(() => {
    settings.currentTerm;
    loadData();
  });

  const filteredResidents = $derived.by(() => {
    return residents
      .filter((r) => {
        const search = tableSync.filters!.search.toLowerCase();
        return (
          r.name?.toLowerCase().includes(search) ||
          r.email?.toLowerCase().includes(search) ||
          r.room?.toLowerCase().includes(search)
        );
      })
      .filter((r) => tableSync.filters!.room === "ALL" || r.room === tableSync.filters!.room)
      .filter((r) => matchesStatusFilter(r, tableSync.filters!.status));
  });

  const rooms = $derived([
    "ALL",
    ...new Set(
      residents
        .map((r) => r.room)
        .filter(Boolean)
        .sort()
    )
  ]);

  const roomOptions = $derived(
    rooms.map((r) => ({ value: r, label: r === "ALL" ? "All Rooms" : r }))
  );

  const statusOptions = [
    { value: "ALL", label: "All Statuses" },
    { value: "FULLY_PAID", label: "Fully Paid" },
    { value: "HALF_FULLY_PAID", label: "Half-Fully Paid" },
    { value: "PARTIALLY_PAID", label: "Partially Paid" },
    { value: "NO_PAYMENT", label: "No Payment" },
    { value: "CLEARED", label: "Cleared" }
  ];

  function resetFilters() {
    tableSync.reset();
  }

  function prepareDispatchForStatementOfAccount() {
    if (selectedIndices.size === 0) return;
    const selectedResidents = residents.filter((r) => selectedIndices.has(r.stno));
    stageStatementOfAccountEmailBatch(selectedResidents, brandingState.profile, {
      clearQueue: true,
      customReminders,
      redirect: true
    });
  }

  function prepareDispatchForPaymentStatus() {
    if (selectedIndices.size === 0) return;
    const selectedResidents = residents.filter((r) => selectedIndices.has(r.stno));
    stageStatusEmailBatch(selectedResidents, brandingState.profile, {
      clearQueue: true,
      customReminders,
      redirect: true
    });
  }

  function prepareDispatchForClearance() {
    if (selectedIndices.size === 0) return;
    const selectedResidents = residents.filter(
      (r) =>
        selectedIndices.has(r.stno) &&
        r.ceLink &&
        r.ceLink !== "N/A" &&
        r.ceLink !== "" &&
        r.ceIssued
    );
    if (selectedResidents.length === 0) {
      globalDialog.show("Dispatch Blocked", "No cleared residents found among the selection.");
      return;
    }
    stageClearanceEmailBatch(selectedResidents, brandingState.profile, {
      clearQueue: true,
      redirect: true
    });
  }

  let isClearDialogOpen = $state(false);
  let residentsToClear = $state<Resident[]>([]);
  let isAwardDialogOpen = $state(false);
  let residentsToAward = $state<Resident[]>([]);

  async function handleBatchClear() {
    if (selectedIndices.size === 0) {
      return;
    }
    const eligible = residents.filter((r) => {
      return (
        selectedIndices.has(r.stno) &&
        r.bal <= 0 &&
        r.totalBase > 0 &&
        (!r.ceIssued || r.ceIssued === "" || r.ceIssued === "#N/A")
      );
    });

    if (eligible.length === 0) {
      globalDialog.show(
        "Clearance Blocked",
        "No eligible residents found in the selection (must be fully paid and not yet cleared)."
      );
      return;
    }

    residentsToClear = eligible;
    isClearDialogOpen = true;
  }

  function handleBatchAward() {
    if (!features.achievementsEnabled) {
      return;
    }
    if (selectedIndices.size === 0) {
      return;
    }
    residentsToAward = residents.filter((r) => {
      return selectedIndices.has(r.stno);
    });
    isAwardDialogOpen = true;
  }
</script>

<Tooltip.Provider>
  <div class="mx-auto max-w-7xl space-y-3">
    <ContentHeader
      title="Residents"
      isTopLevel={true}
      onRefresh={() => loadData(true)}
      isRefreshing={isLoading}
      hasFilter={true}
      actions={[
        {
          label: "Export",
          icon: DownloadIcon,
          href: "/admin/residents/export"
        }
      ]}
    >
      {#snippet tabs()}
        <AdminResidentsTabs active="list" />
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
          Number(tableSync.filters!.room !== "ALL") +
          Number(tableSync.filters!.status !== "ALL")}
        onClear={resetFilters}
      >
        <div class="grid gap-2 lg:grid-cols-9">
          <div class="space-y-1 lg:col-span-5">
            <Label>Search</Label>
            <InputGroup.Root class="h-9 text-sm">
              <InputGroup.Input
                bind:value={tableSync.filters!.search}
                placeholder="Search by name, email, or room…"
              />
              <InputGroup.Addon>
                <Search class="h-4 w-4" />
              </InputGroup.Addon>
            </InputGroup.Root>
          </div>

          <div class="space-y-1 lg:col-span-2">
            <Label>Room</Label>
            <Combobox bind:value={tableSync.filters!.room} options={roomOptions} class="h-9" />
          </div>

          <div class="space-y-1 lg:col-span-2">
            <Label>Payment Status</Label>
            <Combobox bind:value={tableSync.filters!.status} options={statusOptions} class="h-9" />
          </div>
        </div>
      </FilterDrawer>

      {#if filteredResidents.length > 0}
        <DataTable
          data={filteredResidents}
          {columns}
          pagination={tableSync.pagination}
          onPaginationChange={(p) => (tableSync.pagination = p)}
          onRowClick={(r) => goto(`/admin/users/${r.residentId}?term=${r.period}`)}
          onSelectionChange={(ids) => (selectedIndices = ids)}
          rowId="id"
          enableSelection
          sorting={[{ id: "name", desc: false }]}
        >
          {#snippet actions()}
            <DropdownMenu.Root>
              <DropdownMenu.Trigger>
                {#snippet child({ props })}
                  <Button variant="outline" size="sm" {...props} icon={Mail}>
                    Send
                    <ChevronDown class="ml-2 h-3 w-3 opacity-50" />
                  </Button>
                {/snippet}
              </DropdownMenu.Trigger>
              <DropdownMenu.Content align="end" class="w-56">
                <DropdownMenu.Item onclick={prepareDispatchForStatementOfAccount}>
                  <Mail class="mr-2 h-4 w-4" />
                  <span>Send Statement of Account</span>
                </DropdownMenu.Item>
                <DropdownMenu.Item onclick={prepareDispatchForPaymentStatus}>
                  <Mail class="mr-2 h-4 w-4" />
                  <span>Send Payment Status</span>
                </DropdownMenu.Item>
                <DropdownMenu.Item onclick={prepareDispatchForClearance}>
                  <FileCheck class="mr-2 h-4 w-4" />
                  <span>Send Clearance Certificate</span>
                </DropdownMenu.Item>
              </DropdownMenu.Content>
            </DropdownMenu.Root>

            {#if features.achievementsEnabled}
              <Button variant="outline" size="sm" onclick={handleBatchAward} icon={Trophy}>
                Award
              </Button>
            {/if}

            <Button size="sm" onclick={handleBatchClear} icon={ShieldCheck}>Mark as Cleared</Button>
          {/snippet}
        </DataTable>
      {:else}
        <EmptyView
          title="No residents found."
          description="Try adjusting your filters or search query."
        >
          {#snippet icon()}
            <Users class="h-8 w-8 text-muted-foreground" />
          {/snippet}
        </EmptyView>
      {/if}
    {/if}
  </div>
</Tooltip.Provider>

<ClearanceDialog
  bind:open={isClearDialogOpen}
  residents={residentsToClear}
  onSuccess={(count) => {
    globalDialog.show("Success", `${pluralize(count, "resident", "residents")} marked as cleared.`);
    selectedIndices = new Set(); // Clear selection after success
  }}
/>

<AwardDialog
  bind:open={isAwardDialogOpen}
  residents={residentsToAward}
  onSuccess={(count) => {
    selectedIndices = new Set();
  }}
/>
