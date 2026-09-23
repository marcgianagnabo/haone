<script lang="ts">
  import {
    type FridgeItemRecord,
    FridgeItemStatus,
    FridgeCompartment,
    FRIDGE_TAG_LABELS
  } from "$lib/types";
  import * as InputGroup from "$ui/input-group";
  import { Label } from "$ui/label";
  import { Combobox } from "$ui/combobox";
  import FridgeItemCard from "$components/residents/FridgeItemCard.svelte";
  import FilterDrawer from "$components/content/FilterDrawer.svelte";
  import EmptyView from "$components/content/EmptyView.svelte";
  import { Refrigerator, Search } from "@lucide/svelte";

  let {
    items = [],
    currentResidentId = "",
    isAdmin = false,
    processingId = null,
    onTakeOut,
    onPutBack,
    onDiscard
  }: {
    items: FridgeItemRecord[];
    currentResidentId: string;
    isAdmin?: boolean;
    processingId?: string | null;
    onTakeOut: (item: FridgeItemRecord) => void;
    onPutBack: (item: FridgeItemRecord) => void;
    onDiscard: (item: FridgeItemRecord) => void;
  } = $props();

  let searchQuery = $state("");
  let filterCompartment = $state<string>("ALL");
  let filterStatus = $state<string>("ACTIVE");

  const compartmentOptions = [
    { value: "ALL", label: "All Compartments" },
    { value: "REFRIGERATOR", label: "Refrigerator" },
    { value: "FREEZER", label: "Freezer" }
  ];

  const statusOptions = [
    { value: "ACTIVE", label: "All Stored Items" },
    { value: "EXPIRED", label: "Expired Soon / Expired" },
    { value: "TAKEN_OUT", label: "Taken Out" },
    { value: "DISCARDED", label: "Discarded" },
    { value: "ALL", label: "All Statuses" }
  ];

  const filteredItems = $derived.by(() => {
    let list = items;

    // Status filter
    if (filterStatus === "ACTIVE") {
      list = list.filter((i) => i.status === FridgeItemStatus.STORED);
    } else if (filterStatus === "EXPIRED") {
      list = list.filter((i) => {
        if (i.status !== FridgeItemStatus.STORED) {
          return false;
        }
        if (!i.expiryDate) {
          return false;
        }
        const exp = new Date(i.expiryDate);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        return exp <= today || (exp.getTime() - today.getTime()) / (1000 * 60 * 60 * 24) <= 3;
      });
    } else if (filterStatus === "TAKEN_OUT") {
      list = list.filter((i) => i.status === FridgeItemStatus.CHECKED_OUT);
    } else if (filterStatus === "DISCARDED") {
      list = list.filter((i) => i.status === FridgeItemStatus.DISCARDED);
    }

    // Compartment filter
    if (filterCompartment === "REFRIGERATOR") {
      list = list.filter((i) => i.compartment === FridgeCompartment.REFRIGERATOR);
    } else if (filterCompartment === "FREEZER") {
      list = list.filter((i) => i.compartment === FridgeCompartment.FREEZER);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (i) =>
          i.name.toLowerCase().includes(q) ||
          (i.residentName || "").toLowerCase().includes(q) ||
          (i.room || "").toLowerCase().includes(q) ||
          (i.locationDetails || "").toLowerCase().includes(q) ||
          (i.notes || "").toLowerCase().includes(q) ||
          (i.tags || []).some((t) => (FRIDGE_TAG_LABELS[t] || t).toLowerCase().includes(q))
      );
    }

    return list;
  });

  const filteredUserItems = $derived.by(() => {
    if (!currentResidentId) {
      return [];
    }
    return filteredItems.filter((i) => i.residentId === currentResidentId);
  });

  const filteredOtherItems = $derived.by(() => {
    if (!currentResidentId) {
      return filteredItems;
    }
    return filteredItems.filter((i) => i.residentId !== currentResidentId);
  });
</script>

{#snippet fridgeItemGrid(gridItems: FridgeItemRecord[])}
  <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
    {#each gridItems as item (item.id)}
      <FridgeItemCard
        {item}
        {currentResidentId}
        {isAdmin}
        {processingId}
        {onTakeOut}
        {onPutBack}
        {onDiscard}
      />
    {/each}
  </div>
{/snippet}

<FilterDrawer
  activeCount={Number(searchQuery !== "") +
    Number(filterCompartment !== "ALL") +
    Number(filterStatus !== "ACTIVE")}
>
  <div class="grid items-end gap-4 lg:grid-cols-12">
    <div class="space-y-1 lg:col-span-6">
      <Label>Search</Label>
      <InputGroup.Root class="h-9">
        <InputGroup.Input
          bind:value={searchQuery}
          placeholder="Search items, owner, room, tags, location…"
        />
        <InputGroup.Addon>
          <Search />
        </InputGroup.Addon>
      </InputGroup.Root>
    </div>

    <div class="space-y-1 lg:col-span-3">
      <Label>Compartment</Label>
      <Combobox
        bind:value={filterCompartment}
        options={compartmentOptions}
        placeholder="Select compartment..."
        class="h-9"
      />
    </div>

    <div class="space-y-1 lg:col-span-3">
      <Label>Status</Label>
      <Combobox
        bind:value={filterStatus}
        options={statusOptions}
        placeholder="Select status..."
        class="h-9"
      />
    </div>
  </div>
</FilterDrawer>

<!-- Items Grid -->
{#if filteredItems.length === 0}
  <EmptyView
    title="No fridge items found"
    description={searchQuery || filterCompartment !== "ALL" || filterStatus !== "ACTIVE"
      ? "Try adjusting your search query or filters."
      : "Items stored in the refrigerator or freezer will appear here."}
  >
    {#snippet icon()}
      <Refrigerator class="h-10 w-10 text-muted-foreground" />
    {/snippet}
  </EmptyView>
{:else}
  {#if !isAdmin}
    <h2 class="h2-base">My Items</h2>
    {#if filteredUserItems.length === 0}
      <EmptyView
        title="No fridge items found"
        description={searchQuery || filterCompartment !== "ALL" || filterStatus !== "ACTIVE"
          ? "Try adjusting your search query or filters."
          : "Items you have stored in the refrigerator or freezer will appear here."}
      >
        {#snippet icon()}
          <Refrigerator class="h-10 w-10 text-muted-foreground" />
        {/snippet}
      </EmptyView>
    {:else}
      {@render fridgeItemGrid(filteredUserItems)}
    {/if}
  {/if}

  <h2 class="h2-base">Other Items</h2>
  {#if filteredOtherItems.length === 0}
    <EmptyView
      title="No fridge items found"
      description={searchQuery || filterCompartment !== "ALL" || filterStatus !== "ACTIVE"
        ? "Try adjusting your search query or filters."
        : "Items stored in the refrigerator or freezer by other residents will appear here."}
    >
      {#snippet icon()}
        <Refrigerator class="h-10 w-10 text-muted-foreground" />
      {/snippet}
    </EmptyView>
  {:else}
    {@render fridgeItemGrid(filteredOtherItems)}
  {/if}
{/if}
