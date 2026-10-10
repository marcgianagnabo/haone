<script lang="ts">
  import { pageState } from "$state/page-info.svelte";
  import { goto } from "$app/navigation";
  import { onMount } from "svelte";
  import { roomsState } from "$state/rooms.svelte";
  import { fetchResidents, fetchUsers } from "$api/controllers/resident-controller";
  import type { ResidentRecord, UserRecord } from "$lib/types";
  import ContentHeader from "$components/content/ContentHeader.svelte";
  import FilterDrawer from "$components/content/FilterDrawer.svelte";
  import LoadingView from "$components/content/LoadingView.svelte";
  import ErrorView from "$components/content/ErrorView.svelte";
  import { Button } from "$ui/button";
  import { Badge } from "$ui/badge";
  import { Combobox } from "$ui/combobox";
  import { normalizeStudentNo } from "$utils/student-no";
  import { Label } from "$ui/label";
  import { Checkbox } from "$ui/checkbox";
  import * as Card from "$ui/card";
  import * as Tooltip from "$ui/tooltip";
  import RoomActionDialog from "$components/forms/RoomActionDialog.svelte";
  import AdminResidentsTabs from "$components/tabs/AdminResidentsTabs.svelte";
  import {
    RefreshCcw,
    User,
    Users,
    Bed,
    CircleCheck,
    CircleAlert,
    ExternalLink,
    ShieldCheck,
    ChevronRight,
    DownloadIcon
  } from "@lucide/svelte";
  import { settings } from "$state/settings.svelte";

  let residents = $state<ResidentRecord[]>([]);
  let users = $state<UserRecord[]>([]);
  let isLoading = $state(false);
  let error = $state<string | null>(null);

  let selectedUnit = $state("ALL");
  let isCompact = $state(false);

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
      residents = resData.filter((r) => r.period === settings.currentTerm);
      users = userData;
    } catch (e: any) {
      error = e.message;
    } finally {
      isLoading = false;
    }
  }

  $effect(() => {
    settings.currentTerm;
    loadData();
  });

  const occupancyMap = $derived.by(() => {
    const map = new Map<string, ResidentRecord>();
    residents.forEach((r) => {
      if (r.room && r.bed) {
        map.set(`${r.room}-${r.bed}`.toUpperCase(), r);
      }
    });
    return map;
  });

  const unassignedResidents = $derived(residents.filter((r) => !r.room));

  function getRoomOccupancy(roomNumber: string) {
    return residents.filter((r) => r.room === roomNumber).length;
  }

  function getResidentsNoBed(roomNumber: string) {
    return residents.filter((r) => r.room === roomNumber && !r.bed);
  }

  const userOptions = $derived(
    users.map((u) => ({
      value: u.id,
      label: `${u.displayName} (${normalizeStudentNo(u.studentNo) || u.email})`
    }))
  );

  const currentRoom = $derived(
    roomsState.config.find((r) => r.room_number === assignmentDialog.room)
  );

  const availableBedOptions = $derived(
    currentRoom
      ? currentRoom.slots
          .filter((slot) => !occupancyMap.has(`${assignmentDialog.room}-${slot}`))
          .map((slot) => ({ value: slot, label: `Bed ${slot}` }))
      : []
  );

  const unitOptions = $derived.by(() => {
    const units = new Set<string>();
    roomsState.config.forEach((r) => {
      units.add(roomsState.getUnit(r.room_number));
    });
    return Array.from(units).sort();
  });

  const filteredRooms = $derived(
    roomsState.config.filter(
      (r) => selectedUnit === "ALL" || roomsState.getUnit(r.room_number) === selectedUnit
    )
  );

  let assignmentDialog = $state({
    open: false,
    room: "",
    bed: "",
    userId: "",
    isOccupied: false
  });

  function openAssign(room: string, bed: string, currentRes?: ResidentRecord) {
    assignmentDialog = {
      open: true,
      room,
      bed,
      userId: currentRes?.residentId || "",
      isOccupied: !!currentRes
    };
  }

  onMount(() => {
    pageState.title = "Rooms";
  });
</script>

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
      <AdminResidentsTabs active="rooms" />
    {/snippet}
  </ContentHeader>

  <FilterDrawer activeCount={Number(selectedUnit !== "ALL")}>
    <div class="grid items-end gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <div class="space-y-1">
        <Label>Unit</Label>
        <Combobox
          bind:value={selectedUnit}
          options={[
            { value: "ALL", label: "All Units" },
            ...unitOptions.map((u) => ({ value: u, label: `Unit ${u}` }))
          ]}
          placeholder="Filter by Unit"
          class="h-9"
        />
      </div>
      <div class="flex items-center gap-2 pb-2">
        <Checkbox id="compact-view" bind:checked={isCompact} />
        <Label
          for="compact-view"
          class="cursor-pointer text-sm leading-none font-medium peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
        >
          Compact View
        </Label>
      </div>
    </div>
  </FilterDrawer>

  {#if unassignedResidents.length > 0}
    <Card.Root class="border-destructive/20 bg-destructive/5">
      <Card.Header class="p-4">
        <div class="flex items-center gap-2 text-destructive">
          <CircleAlert class="h-5 w-5" />
          <Card.Title class="text-base font-bold"
            >Unassigned Residents ({unassignedResidents.length})</Card.Title
          >
        </div>
        <Card.Description
          >Residents for the current term without a room assignment.</Card.Description
        >
      </Card.Header>
      <Card.Content class="p-4 pt-0">
        <div class="flex flex-wrap gap-2">
          {#each unassignedResidents as res}
            <Badge variant="outline" class="bg-background">
              {res.name} ({res.stno || res.email})
            </Badge>
          {/each}
        </div>
      </Card.Content>
    </Card.Root>
  {/if}

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
  {:else}
    <div class="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
      {#each filteredRooms as room}
        {#if isCompact}
          <button
            onclick={() => goto(`/admin/residents/rooms/${room.room_number}`)}
            class="group flex w-full items-center gap-3 rounded-xl border bg-muted/30 p-3 text-left transition-all hover:bg-muted/50 {room.unavailable_reason
              ? 'opacity-60 grayscale'
              : ''}"
          >
            <div class="rounded-lg bg-muted p-2 text-muted-foreground">
              {#if room.slots.every((slot) => occupancyMap.has(`${room.room_number}-${slot}`))}
                <ShieldCheck class="h-5 w-5 text-primary" />
              {:else}
                {@const occupancy = getRoomOccupancy(room.room_number)}
                {#if occupancy > 0}
                  <Users class="h-5 w-5 text-muted-foreground" />
                {:else}
                  <Bed class="h-5 w-5" />
                {/if}
              {/if}
            </div>
            <div class="min-w-0 flex-1">
              <div class="flex items-center gap-3">
                <p
                  class="text-base font-bold text-foreground transition-colors group-hover:text-primary"
                >
                  {room.room_number}
                </p>
                {#if room.unavailable_reason}
                  <span class="text-xs font-bold text-destructive uppercase">
                    {room.unavailable_reason}
                  </span>
                {:else}
                  <Badge variant="outline" class="uppercase">
                    {getRoomOccupancy(room.room_number)}/{room.available_slots.length}
                  </Badge>
                {/if}
              </div>
            </div>
            <div class="flex items-center gap-1">
              <ChevronRight
                class="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-1"
              />
            </div>
          </button>
        {:else}
          <Card.Root
            class="gap-0 overflow-hidden p-0 {room.unavailable_reason
              ? 'opacity-60 grayscale'
              : ''}"
          >
            <Card.Header class="bg-muted/50 p-3">
              <div class="flex items-center justify-between">
                <a
                  href="/admin/residents/rooms/{room.room_number}"
                  class="group/title flex items-center gap-1.5 transition-colors hover:text-primary"
                >
                  <Card.Title class="text-lg font-bold">{room.room_number}</Card.Title>
                  <ExternalLink
                    class="h-3 w-3 opacity-0 transition-opacity group-hover/title:opacity-100"
                  />
                </a>
                {#if room.unavailable_reason}
                  <Tooltip.Root>
                    <Tooltip.Trigger>
                      <CircleAlert class="h-4 w-4 text-destructive" />
                    </Tooltip.Trigger>
                    <Tooltip.Content>
                      <p class="text-xs">{room.unavailable_reason}</p>
                    </Tooltip.Content>
                  </Tooltip.Root>
                {:else}
                  <Badge variant="outline" class="uppercase">
                    {getRoomOccupancy(room.room_number)}/{room.available_slots.length}
                  </Badge>
                {/if}
              </div>
            </Card.Header>
            {#if !isCompact}
              <Card.Content class="p-3">
                <div class="grid grid-cols-1 gap-2">
                  {#each room.slots as slot}
                    {@const key = `${room.room_number}-${slot}`}
                    {@const resident = occupancyMap.get(key.toUpperCase())}
                    {@const isSlotAvailable =
                      room.available_slots.includes(slot) && !room.unavailable_reason}
                    <button
                      class="group relative flex flex-col items-center justify-center rounded-xl border border-dashed p-2 transition-all hover:bg-muted/50 {resident
                        ? 'border-primary/50 bg-primary/5'
                        : 'border-muted-foreground/30'} {!isSlotAvailable && !resident
                        ? 'cursor-not-allowed opacity-40 grayscale'
                        : ''}"
                      onclick={() =>
                        (isSlotAvailable || !!resident) &&
                        openAssign(room.room_number, slot, resident)}
                      disabled={!isSlotAvailable && !resident}
                    >
                      <div class="flex w-full items-center justify-between">
                        <span class="text-xs font-bold text-muted-foreground">{slot}</span>
                        {#if resident}
                          <CircleCheck class="h-3 w-3 text-primary" />
                        {/if}
                      </div>
                      <span class="mt-2 w-full truncate text-center text-xs font-medium">
                        {resident ? resident.name : "Available"}
                      </span>
                    </button>
                  {/each}
                </div>

                {#if getResidentsNoBed(room.room_number).length > 0}
                  <div class="mt-3 space-y-1">
                    <p class="text-xs font-bold text-muted-foreground uppercase">No Bed Assigned</p>
                    {#each getResidentsNoBed(room.room_number) as res}
                      <button
                        class="transition-hover flex w-full items-center gap-2 rounded-lg border bg-muted/30 p-1.5 text-left text-xs hover:bg-muted/50"
                        onclick={() => openAssign(room.room_number, "", res)}
                      >
                        <User class="h-3 w-3 text-muted-foreground" />
                        <span class="truncate font-medium">{res.name}</span>
                      </button>
                    {/each}
                  </div>
                {/if}
              </Card.Content>
            {/if}
          </Card.Root>
        {/if}
      {/each}
    </div>
  {/if}
</div>

<RoomActionDialog
  bind:open={assignmentDialog.open}
  room={assignmentDialog.room}
  bind:bed={assignmentDialog.bed}
  bind:userId={assignmentDialog.userId}
  isOccupied={assignmentDialog.isOccupied}
  activeTerm={settings.currentTerm}
  {userOptions}
  {availableBedOptions}
  onSuccess={() => loadData(true)}
/>
