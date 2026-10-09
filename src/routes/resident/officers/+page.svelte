<script lang="ts">
  import { onMount } from "svelte";
  import { Button } from "$ui/button";
  import { RefreshCcw, BookUser, Mail } from "@lucide/svelte";
  import LoadingView from "$components/content/LoadingView.svelte";
  import ErrorView from "$components/content/ErrorView.svelte";
  import ContentHeader from "$components/content/ContentHeader.svelte";
  import EmptyView from "$components/content/EmptyView.svelte";
  import * as Card from "$ui/card";
  import { fetchOfficers } from "$api/controllers/officer-controller";
  import { Badge } from "$ui/badge";

  import { pageState } from "$state/page-info.svelte";

  let officers = $state<any[]>([]);
  let isLoading = $state(true);
  let error = $state<string | null>(null);

  function officerPhoto(o: any): string {
    return (o.photoUrl || o.photoAutoUrl || "").trim();
  }

  function officerInitials(o: any): string {
    const name = (o.name || "").trim();
    if (!name) {
      return "?";
    }
    const parts = name.replace(",", " ").split(/\s+/).filter(Boolean);
    return ((parts[0]?.[0] || "") + (parts[1]?.[0] || "")).toUpperCase() || "?";
  }

  async function loadData(bypassCache = false) {
    isLoading = true;
    error = null;
    try {
      officers = await fetchOfficers(bypassCache);
    } catch (e: any) {
      error = e.message;
    } finally {
      isLoading = false;
    }
  }

  onMount(() => {
    pageState.title = "Officers";
    loadData();
  });
</script>

<div class="mx-auto max-w-7xl space-y-3">
  <ContentHeader
    title="Officers"
    isTopLevel={true}
    onRefresh={() => loadData(true)}
    isRefreshing={isLoading}
  />

  {#if isLoading}
    <div>
      <LoadingView />
    </div>
  {:else if error}
    <ErrorView {error}>
      <Button onclick={() => loadData()} class="mt-4" {isLoading} icon={RefreshCcw}>Retry</Button>
    </ErrorView>
  {:else if officers.length === 0}
    <EmptyView title="No officers listed." description="The directory is currently empty.">
      {#snippet icon()}
        <BookUser class="h-8 w-8 text-muted-foreground" />
      {/snippet}
    </EmptyView>
  {:else}
    <div class="mx-auto grid max-w-5xl gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {#each officers as o}
        <Card.Root
          class="flex flex-col border-none bg-card text-center transition-all hover:shadow-md"
        >
          <Card.Header class="pb-2">
            {#if officerPhoto(o)}
              <img
                src={officerPhoto(o)}
                alt={o.name}
                class="mx-auto mb-3 h-20 w-20 rounded-full object-cover"
                loading="lazy"
              />
            {:else}
              <div
                class="mx-auto mb-3 grid h-20 w-20 place-items-center rounded-full bg-brand/10 text-2xl font-bold text-brand"
              >
                {officerInitials(o)}
              </div>
            {/if}
            <Card.Title class="text-2xl font-bold">
              {o.name}
            </Card.Title>

            <div class="mt-1 flex flex-col gap-1">
              <span class="text-xs font-bold tracking-widest text-primary uppercase">
                {o.position}
              </span>
              {#if o.nickname}
                <p class="font-serif text-sm font-normal text-muted-foreground italic">
                  {o.nickname}
                </p>
              {/if}
            </div>
          </Card.Header>

          <Card.Content class="mt-auto">
            <div class="flex items-center justify-between border-t pt-4">
              {#if o.room && o.room !== "N/A"}
                <span class="text-xs font-semibold tracking-wider uppercase">
                  Room {o.room}
                </span>
              {/if}
              {#if o.committee && o.committee !== "N/A"}
                <span class="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                  {o.committee} Committee
                </span>
              {/if}
            </div>
          </Card.Content>
        </Card.Root>
      {/each}
    </div>
  {/if}
</div>
