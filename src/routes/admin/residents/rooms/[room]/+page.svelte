<script lang="ts">
  import { roomsState } from "$state/rooms.svelte";
  import { fetchResidents, fetchUsers } from "$api/controllers/resident-controller";
  import type { ResidentRecord, UserRecord } from "$lib/types";
  import RoomActionDialog from "$components/forms/RoomActionDialog.svelte";
  import ContentHeader from "$components/content/ContentHeader.svelte";
  import LoadingView from "$components/content/LoadingView.svelte";
  import ErrorView from "$components/content/ErrorView.svelte";
  import { Button } from "$ui/button";
  import * as Card from "$ui/card";
  import { RefreshCcw, Users, Bed, Info } from "@lucide/svelte";
  import { onMount } from "svelte";
  import { pageState } from "$state/page-info.svelte";
  import { normalizeStudentNo } from "$utils/student-no";
  import { settings } from "$state/settings.svelte.js";

  let { data } = $props();
  const roomNumber = $derived(data.roomNumber);

  onMount(() => {
    pageState.title = `Room ${data.roomNumber}`;
  });

  let residents = $state<ResidentRecord[]>([]);
  let users = $state<UserRecord[]>([]);
  let isLoading = $state(false);
  let error = $state<string | null>(null);

  $effect(() => {
    settings.currentTerm;
    loadData();
  });

  async function loadData(bypassCache = false) {
    isLoading = true;
    error = null;
    try {
      const [resData, userData] = await Promise.all([
        fetchResidents(bypassCache),
        fetchUsers(bypassCache)
      ]);
      if (!settings.currentTerm) {
        throw new Error("Active academic term (TERM_CURR) not found in constants.");
      }
      residents = resData.filter((r) => r.period === settings.currentTerm && r.room === roomNumber);
      users = userData;
    } catch (e: any) {
      error = e.message;
    } finally {
      isLoading = false;
    }
  }

  const roomConfig = $derived(roomsState.config.find((r) => r.room_number === roomNumber));

  const occupancyMap = $derived.by(() => {
    const map = new Map<string, ResidentRecord>();
    residents.forEach((r) => {
      if (r.bed) {
        map.set(r.bed.toUpperCase(), r);
      }
    });
    return map;
  });

  const residentsNoBed = $derived(residents.filter((r) => !r.bed));

  const userOptions = $derived(
    users.map((u) => ({
      value: u.id,
      label: `${u.displayName} (${normalizeStudentNo(u.studentNo) || u.email})`
    }))
  );

  const availableBedOptions = $derived(
    roomConfig
      ? roomConfig.slots
          .filter((slot) => !occupancyMap.has(slot))
          .map((slot) => ({ value: slot, label: `Bed ${slot}` }))
      : []
  );

  let assignmentDialog = $state({
    open: false,
    bed: "",
    userId: "",
    isOccupied: false
  });

  function openAssign(bed: string, currentRes?: ResidentRecord) {
    assignmentDialog = {
      open: true,
      bed,
      userId: currentRes?.residentId || "",
      isOccupied: !!currentRes
    };
  }
</script>

<div class="mx-auto max-w-7xl space-y-3">
  <ContentHeader
    title="Room {roomNumber}"
    href="/admin/residents/rooms"
    onRefresh={() => loadData(true)}
    isRefreshing={isLoading}
  />

  {#if isLoading && residents.length === 0}
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
  {:else if !roomConfig}
    <ErrorView error="Room configuration not found." />
  {:else}
    <div class="grid gap-6 lg:grid-cols-3">
      <Card.Root class="lg:col-span-2">
        <Card.Header>
          <Card.Title class="flex items-center gap-2 text-lg">
            <Bed class="h-5 w-5" />
            Bed Assignments
          </Card.Title>
          <Card.Description>Manage assignments for each slot in this room.</Card.Description>
        </Card.Header>
        <Card.Content>
          <div class="grid gap-4 sm:grid-cols-2">
            {#each roomConfig.slots as slot}
              {@const resident = occupancyMap.get(slot.toUpperCase())}
              {@const isSlotAvailable =
                roomConfig.available_slots.includes(slot) && !roomConfig.unavailable_reason}

              <div
                class="flex flex-col gap-3 rounded-xl border p-3 sm:flex-row sm:items-center sm:justify-between sm:p-4 {resident
                  ? 'bg-primary/5'
                  : 'bg-muted/20'}"
              >
                <div class="flex min-w-0 flex-1 items-center gap-3 sm:gap-4">
                  <div
                    class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border bg-background text-sm font-bold text-muted-foreground sm:text-base"
                  >
                    {slot}
                  </div>
                  <div class="min-w-0 flex-1">
                    <p class="truncate text-sm font-bold sm:text-base">
                      {resident ? resident.name : "Available"}
                    </p>
                    <p class="truncate text-xs text-muted-foreground">
                      {resident ? resident.stno || resident.email : "No assignment"}
                    </p>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  class="w-full sm:w-auto"
                  onclick={() => openAssign(slot, resident)}
                  disabled={!isSlotAvailable && !resident}
                >
                  {resident ? "Delist" : "Assign"}
                </Button>
              </div>
            {/each}
          </div>
        </Card.Content>
      </Card.Root>

      <div class="space-y-6">
        <Card.Root>
          <Card.Header>
            <Card.Title class="flex items-center gap-2 text-lg">
              <Info class="h-5 w-5" />
              Room Info
            </Card.Title>
          </Card.Header>
          <Card.Content class="space-y-4">
            <div class="flex justify-between text-sm">
              <span class="text-muted-foreground">Total Slots</span>
              <span class="font-bold">{roomConfig.slots.length}</span>
            </div>
            <div class="flex justify-between text-sm">
              <span class="text-muted-foreground">Occupied Beds</span>
              <span class="font-bold">{occupancyMap.size}</span>
            </div>
            {#if roomConfig.unavailable_reason}
              <div class="rounded-lg bg-destructive/10 p-3 text-xs text-destructive">
                <p class="mb-1 font-bold uppercase">Unavailable</p>
                {roomConfig.unavailable_reason}
              </div>
            {/if}
          </Card.Content>
        </Card.Root>

        {#if residentsNoBed.length > 0}
          <Card.Root class="border-primary/20 bg-primary/5">
            <Card.Header>
              <Card.Title class="flex items-center gap-2 text-lg">
                <Users class="h-5 w-5" />
                In-Room (No Bed)
              </Card.Title>
              <Card.Description>Residents assigned to this room but no bed yet.</Card.Description>
            </Card.Header>
            <Card.Content class="space-y-2">
              {#each residentsNoBed as res}
                <div
                  class="flex items-center justify-between rounded-lg border bg-background p-2 text-sm"
                >
                  <span class="mr-2 flex-1 truncate font-medium">{res.name}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    class="h-8 px-2 text-xs"
                    onclick={() => openAssign("", res)}
                  >
                    Pick Bed
                  </Button>
                </div>
              {/each}
            </Card.Content>
          </Card.Root>
        {/if}
      </div>
    </div>
  {/if}
</div>

<RoomActionDialog
  bind:open={assignmentDialog.open}
  room={roomNumber}
  bind:bed={assignmentDialog.bed}
  bind:userId={assignmentDialog.userId}
  isOccupied={assignmentDialog.isOccupied}
  activeTerm={settings.currentTerm}
  {userOptions}
  {availableBedOptions}
  onSuccess={() => loadData(true)}
/>
