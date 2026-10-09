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
  import { ResponsiveDialog } from "$ui/haone";

  import { pageState } from "$state/page-info.svelte";

  let officers = $state<any[]>([]);
  let isLoading = $state(true);
  let error = $state<string | null>(null);
  let previewOfficer = $state<any | null>(null);
  let isPreviewOpen = $state(false);
  let previewBroken = $state(false);

  function officerPhoto(o: any): string {
    return (o.photoUrl || o.photoAutoUrl || "").trim();
  }

  function officerFb(o: any): string {
    return (o.fbLink || "").trim();
  }

  // Display given names only (no surname), never truncated. Prefers the
  // structured given names from the backend; falls back to parsing the
  // directory's "LAST, FIRST ..." format, then to dropping the last token.
  function officerGivenName(o: any): string {
    const structured = (o.givenNames || "").trim();
    if (structured) return structured;
    const full = (o.name || "").trim();
    if (!full) return "";
    const commaAt = full.indexOf(",");
    if (commaAt !== -1) {
      return full.slice(commaAt + 1).trim() || full;
    }
    const parts = full.split(/\s+/).filter(Boolean);
    if (parts.length > 1) {
      return parts.slice(0, -1).join(" ");
    }
    return full;
  }

  function officerInitials(o: any): string {
    const name = (o.name || "").trim();
    if (!name) {
      return "?";
    }
    const parts = name.replace(",", " ").split(/\s+/).filter(Boolean);
    return ((parts[0]?.[0] || "") + (parts[1]?.[0] || "")).toUpperCase() || "?";
  }

  function openPreview(o: any) {
    if (!officerPhoto(o)) return;
    previewOfficer = o;
    previewBroken = false;
    isPreviewOpen = true;
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
    <div class="mx-auto grid max-w-6xl gap-6 sm:grid-cols-2">
      {#each officers as o}
        <Card.Root
          class="flex flex-col border-none bg-card transition-all hover:shadow-md"
        >
          <Card.Header class="pb-2">
            <div class="flex items-center gap-4 text-left">
              {#if officerPhoto(o)}
                <button
                  onclick={() => openPreview(o)}
                  class="shrink-0 cursor-zoom-in rounded-full transition-opacity hover:opacity-80"
                  aria-label="View larger photo of {o.name}"
                >
                  <img
                    src={officerPhoto(o)}
                    alt={o.name}
                    class="h-30 w-30 rounded-full object-cover"
                    loading="lazy"
                  />
                </button>
              {:else}
                <div
                  class="grid h-30 w-30 shrink-0 place-items-center rounded-full bg-brand/10 text-4xl font-bold text-brand"
                >
                  {officerInitials(o)}
                </div>
              {/if}
              <div class="min-w-0 flex-1">
                <Card.Title class="text-2xl font-bold">
                  {officerGivenName(o)}
                </Card.Title>
                <div class="mt-1 flex flex-col gap-1">
                  <span class="text-xs font-bold tracking-widest text-primary uppercase">
                    {o.position}
                  </span>
                </div>
                {#if officerFb(o)}
                  <a
                    href={officerFb(o)}
                    target="_blank"
                    rel="noopener noreferrer"
                    class="mt-2 inline-flex h-8 w-8 items-center justify-center rounded-full bg-brand/10 text-brand transition-colors hover:bg-brand hover:text-brand-foreground"
                    aria-label="Facebook profile of {o.name}"
                    title="Facebook profile"
                  >
                    <svg
                      viewBox="0 0 320 512"
                      class="h-4 w-4 fill-current"
                      aria-hidden="true"
                    >
                      <path
                        d="M279.14 288l14.22-92.66h-88.91v-60.13c0-25.35 12.42-50.06 52.24-50.06h40.42V6.26S260.43 0 225.36 0c-73.22 0-121.08 44.38-121.08 124.72v70.62H22.89V288h81.39v224h100.17V288z"
                      />
                    </svg>
                  </a>
                {/if}
              </div>
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
                <span
                  class="flex-1 text-center text-xs font-semibold tracking-wider text-muted-foreground uppercase"
                >
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

<ResponsiveDialog.Root bind:open={isPreviewOpen}>
  <ResponsiveDialog.Content class="sm:max-w-lg">
    {#if previewOfficer}
      <div class="flex flex-col items-center gap-3">
        {#if !previewBroken}
          <img
            src={officerPhoto(previewOfficer)}
            alt={previewOfficer.name}
            class="max-h-[70vh] w-auto rounded-lg object-contain"
            onerror={() => (previewBroken = true)}
          />
        {:else}
          <div
            class="grid h-40 w-40 place-items-center rounded-full bg-brand/10 text-5xl font-bold text-brand"
          >
            {officerInitials(previewOfficer)}
          </div>
        {/if}
      </div>
    {/if}
  </ResponsiveDialog.Content>
</ResponsiveDialog.Root>
