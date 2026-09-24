<script lang="ts">
  import { pageState } from "$state/page-info.svelte";
  import { onMount } from "svelte";
  import { Button } from "$ui/button";
  import { RefreshCcw, Plus, Megaphone } from "@lucide/svelte";
  import ContentHeader from "$components/content/ContentHeader.svelte";
  import FilterDrawer from "$components/content/FilterDrawer.svelte";
  import EmptyView from "$components/content/EmptyView.svelte";
  import LoadingView from "$components/content/LoadingView.svelte";
  import ErrorView from "$components/content/ErrorView.svelte";
  import { fetchAdminAnnouncements } from "$api/controllers/announcement-controller";
  import { auth } from "$state/auth.svelte";
  import type { AnnouncementRecord } from "$lib/types";
  import { toast } from "svelte-sonner";
  import { goto } from "$app/navigation";

  import { TableSync } from "$ui/data-table/table-sync.svelte";
  import DataTable from "$ui/data-table/data-table.svelte";
  import { columns } from "./columns";
  import * as InputGroup from "$ui/input-group";
  import { Label } from "$ui/label";
  import { Combobox } from "$ui/combobox";
  import { Search } from "@lucide/svelte";

  import { getAnnouncementStatus } from "$api/controllers/announcement-controller";
  import { AnnouncementStatus } from "$lib/types";
  import { globalDialog } from "$state/dialog.svelte";

  let announcements = $state<AnnouncementRecord[]>([]);
  let isLoading = $state(true);
  let error = $state<string | null>(null);
  let selectedIds = $state(new Set<string>());

  const tableSync = new TableSync({
    initialFilters: { search: "", status: "ALL", tags: "ALL" },
    paramMap: { search: "q", status: "status", tags: "tags" },
    searchKey: "search"
  });

  async function loadData(bypassCache = false) {
    isLoading = true;
    error = null;
    try {
      announcements = await fetchAdminAnnouncements(bypassCache);
    } catch (e: any) {
      error = e.message;
    } finally {
      isLoading = false;
    }
  }

  function handleBroadcast() {
    if (selectedIds.size === 0) {
      toast.error("Please select at least one announcement to broadcast.");
      return;
    }

    const count = selectedIds.size;
    const title = count === 1 ? "Broadcast announcement?" : "Broadcast announcements?";
    const target =
      count === 1 ? "the selected announcement" : `all ${count} selected announcements`;

    globalDialog.confirm(
      title,
      `Push notifications will be sent to all subscribed residents for ${target}.`,
      undefined,
      async () => {
        if (selectedIds.size === 0) {
          return;
        }
        try {
          const ids = Array.from(selectedIds);
          const { supabase } = await import("$api/services/common");
          const { data: sbSession } = supabase ? await supabase.auth.getSession() : { data: null };
          const headers: Record<string, string> = {
            Authorization: `Bearer ${auth.credentialJwt}`,
            "Content-Type": "application/json"
          };
          if (sbSession?.session?.access_token) {
            headers["x-supabase-access-token"] = sbSession.session.access_token;
          }
          const resp = await fetch("/api/admin/announcements/broadcast", {
            method: "POST",
            headers,
            body: JSON.stringify({ ids })
          });
          const data = await resp.json();
          if (data.success) {
            toast.success(data.message || "Announcement notifications sent.");
            await loadData();
          } else {
            throw new Error(data.error || "Failed to broadcast");
          }
          toast.success("Announcements broadcasted.");
          selectedIds.clear();
          await loadData();
        } catch (e: any) {
          toast.error(e.message);
        }
      },
      undefined,
      {
        accept: "Broadcast",
        cancel: "Cancel"
      }
    );
  }

  onMount(() => {
    pageState.title = "Announcements";
    loadData();
  });

  const tagsOptions = $derived.by(() => {
    const set = new Set<string>();
    announcements.forEach((a) => {
      (a.tags || "").split(",").forEach((t) => {
        const val = t.trim();
        if (val) set.add(val);
      });
    });
    return Array.from(set); // NO SORT
  });

  const filteredAnnouncements = $derived.by(() => {
    return announcements
      .filter((a) => {
        const search = tableSync.filters!.search.toLowerCase();
        const status = tableSync.filters!.status;
        const tags = tableSync.filters!.tags;
        const currentStatus = getAnnouncementStatus(a);

        const matchesSearch =
          a.title.toLowerCase().includes(search) || a.content.toLowerCase().includes(search);
        const matchesStatus = status === "ALL" || currentStatus === status;
        const matchesTags =
          tags === "ALL" || (a.tags || "").split(",").some((t) => t.trim() === tags);

        return matchesSearch && matchesStatus && matchesTags;
      })
      .sort((a, b) => b.dateCreated.localeCompare(a.dateCreated));
  });

  function resetFilters() {
    tableSync.reset();
  }
</script>

<div class="mx-auto max-w-7xl space-y-3">
  <ContentHeader
    title="Announcements"
    isTopLevel={true}
    onRefresh={() => loadData(true)}
    isRefreshing={isLoading}
    actions={[{ label: "Add", href: "/admin/announcements/add", icon: Plus }]}
    hasFilter={true}
  />

  {#if isLoading}
    <LoadingView />
  {:else if error}
    <ErrorView {error}>
      <Button onclick={() => loadData()} {isLoading} icon={RefreshCcw} class="mt-4">Retry</Button>
    </ErrorView>
  {:else}
    <FilterDrawer
      activeCount={Number(tableSync.filters!.search !== "") +
        Number(tableSync.filters!.status !== "ALL") +
        Number(tableSync.filters!.tags !== "ALL")}
      onClear={resetFilters}
    >
      <div class="grid gap-4 lg:grid-cols-12">
        <div class="space-y-1 lg:col-span-6">
          <Label>Search</Label>
          <InputGroup.Root class="h-9 text-xs">
            <InputGroup.Input
              bind:value={tableSync.filters!.search}
              placeholder="Search announcements…"
            />
            <InputGroup.Addon>
              <Search />
            </InputGroup.Addon>
          </InputGroup.Root>
        </div>

        <div class="space-y-1 lg:col-span-3">
          <Label>Status</Label>
          <Combobox
            bind:value={tableSync.filters!.status}
            options={[
              { value: "ALL", label: "All Status" },
              { value: AnnouncementStatus.ACTIVE, label: "Active" },
              { value: AnnouncementStatus.FUTURE, label: "Future" },
              { value: AnnouncementStatus.EXPIRED, label: "Expired" }
            ]}
            class="h-9"
          />
        </div>

        <div class="space-y-1 lg:col-span-3">
          <Label>Tags</Label>
          <Combobox
            bind:value={tableSync.filters!.tags}
            options={[
              { value: "ALL", label: "All Tags" },
              ...tagsOptions.map((t) => ({ value: t, label: t }))
            ]}
            class="h-9"
          />
        </div>
      </div>
    </FilterDrawer>

    {#if filteredAnnouncements.length > 0}
      <DataTable
        data={filteredAnnouncements}
        {columns}
        pagination={tableSync.pagination}
        onPaginationChange={(p) => (tableSync.pagination = p)}
        onRowClick={(r) => goto(`/admin/announcements/${r.id}/edit`)}
        rowId="id"
        enableSelection={true}
        onSelectionChange={(ids) => (selectedIds = ids)}
        sorting={[{ id: "startDate", desc: true }]}
      >
        {#snippet actions()}
          <Button variant="secondary" size="sm" onclick={handleBroadcast} icon={Megaphone}>
            Broadcast
          </Button>
        {/snippet}
      </DataTable>
    {:else}
      <EmptyView title="No announcements found.">
        {#snippet icon()}
          <Megaphone class="h-8 w-8 text-muted-foreground" />
        {/snippet}
      </EmptyView>
    {/if}
  {/if}
</div>
