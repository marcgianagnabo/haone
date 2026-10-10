<script lang="ts">
  import { pageState } from "$state/page-info.svelte";
  import { onMount } from "svelte";
  import { goto } from "$app/navigation";
  import { settings } from "$state/settings.svelte";
  import { UserTag, type UserRecord as User } from "$lib/types";
  import { fetchUsers } from "$api/controllers/resident-controller";
  import { TableSync } from "$ui/data-table/table-sync.svelte";
  import { Button } from "$ui/button";
  import { Input } from "$ui/input";
  import * as InputGroup from "$ui/input-group";
  import { Combobox } from "$ui/combobox";
  import { Label } from "$ui/label";
  import { RefreshCcw, Plus, Search, Users } from "@lucide/svelte";
  import ContentHeader from "$components/content/ContentHeader.svelte";
  import FilterDrawer from "$components/content/FilterDrawer.svelte";
  import LoadingView from "$components/content/LoadingView.svelte";
  import EmptyView from "$components/content/EmptyView.svelte";
  import ErrorView from "$components/content/ErrorView.svelte";
  import * as DropdownMenu from "$ui/dropdown-menu";
  import { columns } from "./columns";
  import DataTable from "$ui/data-table/data-table.svelte";
  import { translateCollege, translateProgram } from "$utils/translators";
  import { normalizeStudentNo } from "$utils/student-no";

  let users = $state<User[]>([]);
  let isLoading = $state(false);
  let error = $state<string | null>(null);
  const tableSync = new TableSync({
    initialFilters: { search: "", college: "ALL", program: "ALL", tags: "ALL" },
    paramMap: { search: "q", college: "college", program: "program", tags: "tags" },
    searchKey: "search"
  });

  async function loadData(bypassCache = false) {
    isLoading = true;
    error = null;
    try {
      users = await fetchUsers(bypassCache);
    } catch (e: any) {
      error = e.message;
    } finally {
      isLoading = false;
    }
  }

  onMount(() => {
    pageState.title = "Users";
    loadData();
  });

  const collegeOptions = $derived.by(() => {
    const set = new Set<string>();
    users.forEach((u) => {
      translateCollege(u.college).forEach((c) => {
        if (c && c !== "—") set.add(c);
      });
    });
    return Array.from(set).sort();
  });

  const programOptions = $derived.by(() => {
    const set = new Set<string>();
    users.forEach((u) => {
      translateProgram(u.program).forEach((p) => {
        if (p && p !== "—") set.add(p);
      });
    });
    return Array.from(set).sort();
  });

  const tagsOptions = $derived.by(() => {
    const set = new Set<string>();
    users.forEach((u) => {
      (u.tags || UserTag.STUDENT).split(":").forEach((t) => {
        const val = t.trim();
        if (val) set.add(val);
      });
    });
    return Array.from(set).sort();
  });

  const filteredUsers = $derived.by(() => {
    return users
      .filter((u) => {
        const search = tableSync.filters!.search.toLowerCase();
        const stSearch = normalizeStudentNo(tableSync.filters!.search).toLowerCase();
        const college = tableSync.filters!.college;
        const program = tableSync.filters!.program;
        const tags = tableSync.filters!.tags;

        const matchesSearch =
          u.displayName?.toLowerCase().includes(search) ||
          u.email?.toLowerCase().includes(search) ||
          u.studentNo?.toLowerCase().includes(search) ||
          normalizeStudentNo(u.studentNo).toLowerCase().includes(stSearch);

        const matchesCollege =
          college === "ALL" || translateCollege(u.college).some((c) => c === college);

        const matchesProgram =
          program === "ALL" || translateProgram(u.program).some((p) => p === program);

        const matchesTags =
          tags === "ALL" || (u.tags || UserTag.STUDENT).split(":").some((t) => t.trim() === tags);

        return matchesSearch && matchesCollege && matchesProgram && matchesTags;
      })
      .sort((a, b) => (a.studentNo || "").localeCompare(b.studentNo || ""));
  });

  function resetFilters() {
    tableSync.reset();
  }
</script>

<div class="mx-auto max-w-7xl space-y-3">
  <ContentHeader
    title="Users"
    isTopLevel={true}
    onRefresh={() => loadData(true)}
    isRefreshing={isLoading}
    hasFilter={true}
    actions={[
      {
        label: "Add",
        icon: Plus,
        href: "/admin/users/add"
      }
    ]}
  />

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
        Number(tableSync.filters!.college !== "ALL") +
        Number(tableSync.filters!.program !== "ALL") +
        Number(tableSync.filters!.tags !== "ALL")}
      onClear={resetFilters}
    >
      <div class="grid gap-2 lg:grid-cols-12">
        <div class="space-y-1 lg:col-span-4">
          <Label>Search</Label>
          <InputGroup.Root class="h-9 text-xs">
            <InputGroup.Input bind:value={tableSync.filters!.search} placeholder="Search users…" />
            <InputGroup.Addon>
              <Search />
            </InputGroup.Addon>
          </InputGroup.Root>
        </div>

        <div class="space-y-1 lg:col-span-2">
          <Label>College</Label>
          <Combobox
            bind:value={tableSync.filters!.college}
            options={[
              { value: "ALL", label: "All Colleges" },
              ...collegeOptions.map((c) => ({ value: c, label: c }))
            ]}
            class="h-9"
          />
        </div>

        <div class="space-y-1 lg:col-span-3">
          <Label>Program</Label>
          <Combobox
            bind:value={tableSync.filters!.program}
            options={[
              { value: "ALL", label: "All Programs" },
              ...programOptions.map((p) => ({ value: p, label: p }))
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

    {#if filteredUsers.length > 0}
      <DataTable
        data={filteredUsers}
        {columns}
        pagination={tableSync.pagination}
        onPaginationChange={(p) => (tableSync.pagination = p)}
        onRowClick={(r) => goto(`/admin/users/${r.id}`)}
        rowId="id"
        sorting={[{ id: "displayName", desc: false }]}
      />
    {:else}
      <EmptyView title="No users found." description="Try adjusting your filters or search query.">
        {#snippet icon()}
          <Users class="h-8 w-8 text-muted-foreground" />
        {/snippet}
      </EmptyView>
    {/if}
  {/if}
</div>
