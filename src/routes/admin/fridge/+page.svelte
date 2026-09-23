<script lang="ts">
  import { pageState } from "$state/page-info.svelte";
  import { onMount } from "svelte";
  import {
    fetchFridgeItems,
    checkOutFridgeItem,
    restoreFridgeItem,
    discardFridgeItem,
    checkFeatureEnabled
  } from "$api/controllers/fridge-controller";
  import { type FridgeItemRecord } from "$lib/types";
  import ContentHeader from "$components/content/ContentHeader.svelte";
  import FridgeView from "$components/residents/FridgeView.svelte";
  import LoadingView from "$components/content/LoadingView.svelte";
  import ErrorView from "$components/content/ErrorView.svelte";
  import { toast } from "svelte-sonner";
  import { Plus } from "@lucide/svelte";
  import { globalDialog } from "$state/dialog.svelte";

  let isLoading = $state(true);
  let error = $state<string | null>(null);
  let items = $state<FridgeItemRecord[]>([]);
  let currentResidentId = $state("");
  let processingId = $state<string | null>(null);

  async function loadData(bypassCache = false) {
    isLoading = true;
    error = null;
    try {
      await checkFeatureEnabled(bypassCache);
      const res = await fetchFridgeItems(bypassCache);
      items = res.items;
      // Empty string keeps the admin "Other Items" list unfiltered (shows every resident's items).
      // Action handlers fall back to the signed-in user id for actionBy.
      currentResidentId = "";
    } catch (e: any) {
      error = e.message || "Failed to load fridge items.";
    } finally {
      isLoading = false;
    }
  }

  onMount(() => {
    pageState.title = "Fridge";
    loadData();
  });

  async function handleTakeOut(item: FridgeItemRecord) {
    processingId = item.id;
    try {
      await checkFeatureEnabled();
      await checkOutFridgeItem(item.id, currentResidentId);
      toast.success(`Marked ${item.name} as taken out.`);
      await loadData();
    } catch (e: any) {
      toast.error(e.message || "Failed to check out item.");
    } finally {
      processingId = null;
    }
  }

  async function handlePutBack(item: FridgeItemRecord) {
    processingId = item.id;
    try {
      await checkFeatureEnabled();
      await restoreFridgeItem(item, currentResidentId);
      toast.success(`Returned ${item.name} back to fridge!`);
      await loadData();
    } catch (e: any) {
      toast.error(e.message || "Failed to return item to fridge.");
    } finally {
      processingId = null;
    }
  }

  function confirmDiscard(item: FridgeItemRecord) {
    globalDialog.confirm(
      "Discard item?",
      `"${item.name}" and its uploaded photo will be permanently deleted.`,
      undefined,
      async () => {
        processingId = item.id;
        try {
          await checkFeatureEnabled();
          await discardFridgeItem(item.id, currentResidentId);
          toast.success("Item marked as discarded.");
          await loadData();
        } catch (e: any) {
          toast.error(e.message || "Failed to discard item.");
        } finally {
          processingId = null;
        }
      },
      undefined,
      {
        accept: "Discard",
        cancel: "Cancel"
      }
    );
  }
</script>

<div class="mx-auto max-w-7xl space-y-4 pb-16">
  <ContentHeader
    title="Fridge"
    isTopLevel={true}
    onRefresh={() => loadData(true)}
    isRefreshing={isLoading}
    actions={[{ label: "Add", href: "/admin/fridge/add", icon: Plus }]}
    hasFilter={true}
  />

  {#if isLoading}
    <LoadingView />
  {:else if error}
    <ErrorView {error} />
  {:else}
    <FridgeView
      {items}
      {currentResidentId}
      isAdmin={true}
      {processingId}
      onTakeOut={handleTakeOut}
      onPutBack={handlePutBack}
      onDiscard={confirmDiscard}
    />
  {/if}
</div>
