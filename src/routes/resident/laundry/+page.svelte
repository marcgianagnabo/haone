<script lang="ts">
  import { cn } from "$lib/utils";
  import { brandingState } from "$state/branding.svelte";
  import { browser } from "$app/environment";
  import { onMount, tick } from "svelte";
  import { Button } from "$ui/button";
  import { RefreshCcw, Info } from "@lucide/svelte";
  import LoadingView from "$components/content/LoadingView.svelte";
  import ErrorView from "$components/content/ErrorView.svelte";
  import ContentHeader from "$components/content/ContentHeader.svelte";
  import {
    checkFeatureEnabled,
    fetchLaundryBookerNames,
    fetchLaundryReservations
  } from "$api/controllers/laundry-controller";
  import { fetchUsers, canSeeLaundryNames } from "$api/controllers/resident-controller";
  import { type LaundryRecord, type UserRecord, DEFAULT_LAUNDRY_MACHINE } from "$lib/types";
  import LaundryCalendar from "$components/residents/LaundryCalendar.svelte";
  import { pageState } from "$state/page-info.svelte";
  import { residentState } from "$state/resident-state.svelte";
  import { wingMachineForRoom } from "$utils/laundry-slots";
  import CancelLaundryDialog from "$components/forms/CancelLaundryDialog.svelte";
  import BookLaundryDialog from "$components/forms/BookLaundryDialog.svelte";
  import LaundryRulesDialog from "$components/dialogs/LaundryRulesDialog.svelte";
  import { settings } from "$state/settings.svelte";
  import { auth } from "$state/auth.svelte";

  let reservations = $state<LaundryRecord[]>([]);
  let users = $state<UserRecord[]>([]);
  let bookers = $state<Map<string, { name: string; room: string }>>(new Map());
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

      const [resResult, userData, bookerData] = await Promise.all([
        fetchLaundryReservations(true),
        fetchUsers(true),
        fetchLaundryBookerNames()
      ]);

      if (Array.isArray(resResult)) {
        reservations = resResult;
      } else {
        reservations = resResult.reservations;
        currentResidentId = resResult.currentResidentId;
      }
      users = userData;
      bookers = bookerData;
    } catch (e: any) {
      error = e.message;
    } finally {
      isLoading = false;
    }
  }

  onMount(async () => {
    pageState.title = "Laundry";
    // Show the rules first on the resident's first visit; dismissal is
    // remembered in localStorage (see LaundryRulesDialog).
    await tick();
    try {
      if (browser && localStorage.getItem("laundry-rules-seen-v1") !== "1") {
        laundryRulesDialog?.open();
      }
    } catch {}
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

  // Wing focus: L* rooms preset the Left Wing machine, R* rooms the Right
  // Wing machine, anything else (U / upper floors / unknown) sees all.
  const wingMachine = $derived(
    wingMachineForRoom(
      residentState.status?.account?.room || residentState.status?.currEntry?.room || ""
    )
  );
  const wingDefaultMachine = $derived(
    wingMachine === "ALL" ? DEFAULT_LAUNDRY_MACHINE : wingMachine
  );

  // Booker names for the calendar. RLS hides other residents, so names
  // resolve through the get_laundry_booker_names() RPC (Supabase) or the
  // per-row displayName the Sheets GET already sends non-transients.
  // TRANSIENT viewers stay masked: the RPC returns nothing for them and
  // viewerMaySeeNames is false. The signed-in resident is always included
  // so their own bookings show their name instead of the generic fallback.
  const calendarUsers = $derived<(UserRecord & { room?: string })[]>([
    ...users,
    ...Array.from(bookers.entries()).map(
      ([id, b]) => ({ id, displayName: b.name, room: b.room }) as UserRecord & { room?: string }
    ),
    ...(currentResidentId
      ? [
          {
            ...auth.user,
            id: currentResidentId,
            room: residentState.status?.account?.room || "",
            name: auth.user?.displayName || auth.user?.displayNameFormal || ""
          } as UserRecord & { room?: string }
        ]
      : [])
  ]);

  // Non-transients see booker names + rooms like the admin view;
  // TRANSIENT accounts keep seeing "Reserved".
  const viewerMaySeeNames = $derived(
    canSeeLaundryNames(
      residentState.status?.account?.type || residentState.status?.currEntry?.accountType || ""
    )
  );

  const userMap = $derived(
    new Map(
      calendarUsers.flatMap((u: any) => {
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
      users={calendarUsers}
      currentUserId={currentResidentId}
      initialMachineFilter={wingMachine}
      isAdminView={false}
      canSeeNames={viewerMaySeeNames}
      onCancelReservation={(id) => {
        cancelLaundryDialog?.open(id);
      }}
      onSelectSlot={bookLaundryDialog?.handleSelectSlot}
    />
  {/if}
</div>

<BookLaundryDialog
  bind:this={bookLaundryDialog}
  {reservations}
  defaultMachine={wingDefaultMachine}
  onSuccess={() => loadData()}
/>

<CancelLaundryDialog bind:this={cancelLaundryDialog} isAdmin={false} onSuccess={() => loadData()} />

<LaundryRulesDialog bind:this={laundryRulesDialog} />
