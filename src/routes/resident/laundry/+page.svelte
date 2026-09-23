<script lang="ts">
  import { cn } from "$lib/utils";
  import { brandingState } from "$state/branding.svelte";
  import { onMount } from "svelte";
  import { Button } from "$ui/button";
  import { RefreshCcw, Plus, Info } from "@lucide/svelte";
  import LoadingView from "$components/content/LoadingView.svelte";
  import ErrorView from "$components/content/ErrorView.svelte";
  import ContentHeader from "$components/content/ContentHeader.svelte";
  import {
    checkFeatureEnabled,
    fetchLaundryReservations
  } from "$api/controllers/laundry-controller";
  import { fetchUsers } from "$api/controllers/resident-controller";
  import { type LaundryRecord, type UserRecord } from "$lib/types";
  import LaundryCalendar from "$components/residents/LaundryCalendar.svelte";
  import { pageState } from "$state/page-info.svelte";
  import CancelLaundryDialog from "$components/forms/CancelLaundryDialog.svelte";
  import BookLaundryDialog from "$components/forms/BookLaundryDialog.svelte";
  import LaundryRulesDialog from "$components/dialogs/LaundryRulesDialog.svelte";
  import { settings } from "$state/settings.svelte";

  let reservations = $state<LaundryRecord[]>([]);
  let users = $state<UserRecord[]>([]);
  let currentResidentId = $state("");
  let isLoading = $state(true);
  let error = $state<string | null>(null);
  let cancelLaundryDialog = $state<CancelLaundryDialog | null>(null);
  let bookLaundryDialog = $state<BookLaundryDialog | null>(null);

  async function loadData() {
    isLoading = true;
    error = null;
    try {
      await checkFeatureEnabled();

      const [resResult, userData] = await Promise.all([
        fetchLaundryReservations(true),
        fetchUsers(true)
      ]);

      if (Array.isArray(resResult)) {
        reservations = resResult;
      } else {
        reservations = resResult.reservations;
        currentResidentId = resResult.currentResidentId;
      }
      users = userData;
    } catch (e: any) {
      error = e.message;
    } finally {
      isLoading = false;
    }
  }

  onMount(() => {
    pageState.title = "Laundry";
  });

  $effect(() => {
    settings.clockFormat;
    loadData();
  });

  let userReservations = $derived.by(() => {
    if (!currentResidentId) {
      return [];
    }
    return reservations.filter((r) => r.residentId === currentResidentId);
  });

  const userMap = $derived(
    new Map(
      users.flatMap((u: any) => {
        const name = u.displayName || u.name || "Resident";
        const room = u.room || "";
        const data = { name, room };
        const entries: [string, typeof data][] = [];
        const id = u.id || u.residentId;
        const email = u.email;
        if (id) entries.push([id, data]);
        if (email) entries.push([(email || "").trim().toLowerCase(), data]);
        return entries;
      })
    )
  );

  let mappedUserReservations = $derived.by(() => {
    return userReservations.map((r) => {
      const resId = (r.residentId || "").trim();
      const user = userMap.get(resId) || userMap.get(resId.toLowerCase());

      return {
        ...r,
        name: (user as any)?.name || r.displayName || "Resident",
        room: (user as any)?.room || r.room || ""
      };
    });
  });

  let laundryRulesDialog = $state<LaundryRulesDialog | null>(null);
</script>

<div class="mx-auto max-w-7xl space-y-3">
  <ContentHeader
    title="Laundry"
    isTopLevel={true}
    onRefresh={() => loadData()}
    isRefreshing={isLoading}
    actions={[
      {
        label: "Rules",
        onclick: () => laundryRulesDialog?.open(),
        icon: Info,
        variant: "outline"
      },
      {
        label: "Book Slot",
        onclick: () => bookLaundryDialog?.open(),
        icon: Plus
      }
    ]}
  />

  {#if isLoading}
    <LoadingView />
  {:else if error}
    <ErrorView {error}>
      <Button onclick={() => loadData()} class="mt-4" {isLoading} icon={RefreshCcw}>Retry</Button>
    </ErrorView>
  {:else}
    <LaundryCalendar
      {reservations}
      deprecatedMappedReservations={mappedUserReservations}
      {users}
      currentUserId={currentResidentId}
      isAdminView={false}
      onCancelReservation={(id) => {
        cancelLaundryDialog?.open(id);
      }}
      onSelectSlot={bookLaundryDialog?.handleSelectSlot}
    />
  {/if}
</div>

<BookLaundryDialog bind:this={bookLaundryDialog} {reservations} onSuccess={() => loadData()} />

<CancelLaundryDialog bind:this={cancelLaundryDialog} isAdmin={false} onSuccess={() => loadData()} />

<LaundryRulesDialog bind:this={laundryRulesDialog} />
