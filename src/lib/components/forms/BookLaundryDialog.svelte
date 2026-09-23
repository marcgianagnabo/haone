<script lang="ts">
  import {
    addLaundryReservation,
    checkFeatureEnabled,
    validateLaundryReservation
  } from "$api/controllers/laundry-controller";
  import { getSignedInUserId } from "$api/controllers/resident-controller";
  import { Button } from "$components/ui/button";
  import * as DatePicker from "$components/ui/date-picker";
  import { ResponsiveDialog } from "$ui/haone";
  import { Label } from "$components/ui/label";
  import * as TimePicker from "$components/ui/time-picker";
import { Combobox } from "$ui/combobox";
import {
  DEFAULT_LAUNDRY_MACHINE,
  LAUNDRY_MACHINES,
  LaundryStatus,
  type LaundryRecord
} from "$lib/types";
import { formatTime } from "$utils/formatters";
  import { parseTime } from "$utils/parsers";
  import { CircleXIcon, ClockIcon, SlidersHorizontalIcon } from "@lucide/svelte";
  import { toast } from "svelte-sonner";

  let {
    reservations,
    onSuccess,
    isAdmin = false,
    activeUsers = []
  }: {
    reservations: LaundryRecord[];
    onSuccess: () => void;
    isAdmin?: boolean;
    activeUsers?: { id: string; displayName: string; room?: string }[];
  } = $props();

  let isLoading = $state(false);
  let isDialogOpen = $state(false);

  let newReservation = $state({
    date: new Date().toISOString().split("T")[0],
    timeStart: "05:00",
    timeEnd: "07:00",
    residentId: "",
    machine: DEFAULT_LAUNDRY_MACHINE
  });

  let myResidentId = $state("");

  const targetUserId = $derived(isAdmin ? newReservation.residentId : myResidentId);

  function resolveMyResidentId() {
    if (isAdmin || myResidentId) {
      return;
    }
    getSignedInUserId()
      .then((id) => {
        myResidentId = id;
      })
      .catch(() => {
        myResidentId = "";
      });
  }

  function calculateEndTime(start: string, durationMinutes: number): string {
    const parts = (start || "05:00").split(":");
    const startM = (parseInt(parts[0], 10) || 0) * 60 + (parseInt(parts[1], 10) || 0);
    const endM = Math.min(startM + durationMinutes, 24 * 60);
    const h = Math.floor(endM / 60);
    const m = endM % 60;
    return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
  }

  $effect(() => {
    const start = newReservation.timeStart;
    if (durationMode === "1hr") {
      newReservation.timeEnd = calculateEndTime(start, 60);
    } else if (durationMode === "2hrs") {
      newReservation.timeEnd = calculateEndTime(start, 120);
    }
  });

  let durationMode = $state<"1hr" | "2hrs" | "custom">("2hrs");

  const validationError = $derived.by(() => {
    return validateLaundryReservation({
      date: newReservation.date,
      timeStart: newReservation.timeStart,
      timeEnd: newReservation.timeEnd,
      residentId: targetUserId,
      isAdmin,
      machine: newReservation.machine,
      existingReservations: reservations
    });
  });

  async function handleBook() {
    if (validationError) {
      toast.error(validationError);
      return;
    }

    try {
      isLoading = true;
      await checkFeatureEnabled();

      if (!isAdmin && !targetUserId) {
        myResidentId = await getSignedInUserId();
      }
      const residentIdToBook = targetUserId;
      if (!residentIdToBook) {
        throw new Error(
          isAdmin ? "Please select a resident." : "Could not find your resident record."
        );
      }

      await addLaundryReservation(
        {
          id: crypto.randomUUID(),
          residentId: residentIdToBook,
          date: newReservation.date,
          timeStart: formatTime(newReservation.timeStart),
          timeEnd: formatTime(newReservation.timeEnd),
          status: LaundryStatus.ACTIVE,
          machine: newReservation.machine,
          cancelReason: ""
        },
        isAdmin
      );
      toast.success("Reservation successful");
      isDialogOpen = false;
      onSuccess();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      isLoading = false;
    }
  }

  function handleDurationSelect(mode: "1hr" | "2hrs" | "custom") {
    durationMode = mode;
    if (mode === "1hr") {
      newReservation.timeEnd = calculateEndTime(newReservation.timeStart, 60);
    } else if (mode === "2hrs") {
      newReservation.timeEnd = calculateEndTime(newReservation.timeStart, 120);
    }
  }

  export function open() {
    isDialogOpen = true;
    resolveMyResidentId();
  }

  function isHourlyOccupied(date: string, hour: number, machine?: string) {
    return reservations.some((r: LaundryRecord) => {
      if (r.status !== "ACTIVE" || r.date !== date) return false;
      if (machine && (r.machine || DEFAULT_LAUNDRY_MACHINE) !== machine) return false;
      const start = parseTime(r.timeStart);
      const end = parseTime(r.timeEnd);
      return hour >= start && hour < end;
    });
  }

  export function handleSelectSlot(date: string, hour: number, machine?: string) {
    if (machine) {
      if (isHourlyOccupied(date, hour, machine)) {
        toast.error("This machine slot is already booked.");
        return;
      }
      newReservation.machine = machine;
    } else {
      // All-machines view: block only when every machine is occupied.
      const firstFree = LAUNDRY_MACHINES.find((m) => !isHourlyOccupied(date, hour, m.value));
      if (!firstFree) {
        toast.error("All machine slots are booked for this time.");
        return;
      }
      newReservation.machine = firstFree.value;
    }

    newReservation.date = date;
    newReservation.timeStart = `${hour.toString().padStart(2, "0")}:00`;
    durationMode = "1hr";
    newReservation.timeEnd = calculateEndTime(newReservation.timeStart, 60);
    open();
  }
</script>

<ResponsiveDialog.Root bind:open={isDialogOpen}>
  <ResponsiveDialog.Content>
    <ResponsiveDialog.Header>
      <ResponsiveDialog.Title>Book Laundry Slot</ResponsiveDialog.Title>
    </ResponsiveDialog.Header>
    <div class="space-y-6 px-4 pb-4 md:px-0">
      {#if isAdmin}
        <div class="space-y-2">
          <Label>Resident</Label>
          <Combobox
            bind:value={newReservation.residentId}
            options={activeUsers.map((u) => ({
              value: u.id,
              label: `${u.displayName} (${u.room || "No Room"})`
            }))}
            placeholder="Select a resident..."
            searchPlaceholder="Search by name..."
          />
        </div>
      {/if}

      <div class="space-y-2">
        <Label>Date</Label>
        <DatePicker.Root bind:value={newReservation.date} class="w-full" />
      </div>

      <div class="space-y-4">
        <div class="space-y-2">
          <Label>Start Time</Label>
          <TimePicker.Root bind:value={newReservation.timeStart} class="w-full" />
        </div>

        <div class="space-y-2">
          <Label class="text-sm">Duration</Label>
          <div class="grid grid-cols-3 gap-2">
            <Button
              type="button"
              variant={durationMode === "1hr" ? "default" : "outline"}
              size="default"
              class="h-10 text-sm font-medium"
              onclick={() => handleDurationSelect("1hr")}
              icon={ClockIcon}
            >
              1 Hour
            </Button>
            <Button
              type="button"
              variant={durationMode === "2hrs" ? "default" : "outline"}
              size="default"
              class="h-10 text-sm font-medium"
              onclick={() => handleDurationSelect("2hrs")}
              icon={ClockIcon}
            >
              2 Hours
            </Button>
            <Button
              type="button"
              variant={durationMode === "custom" ? "default" : "outline"}
              size="default"
              class="h-10 text-sm font-medium"
              onclick={() => handleDurationSelect("custom")}
              icon={SlidersHorizontalIcon}
            >
              Custom
            </Button>
          </div>
        </div>

        {#if durationMode === "custom"}
          <div class="space-y-2">
            <Label class="text-sm">End Time</Label>
            <TimePicker.Root bind:value={newReservation.timeEnd} class="w-full" />
          </div>
        {:else}
          <div
            class="flex items-center justify-between rounded-lg border border-border bg-muted/30 px-4 py-3 text-sm"
          >
            <span class="font-medium text-muted-foreground">End Time</span>
            <span class="font-semibold text-foreground">{formatTime(newReservation.timeEnd)}</span>
          </div>
        {/if}
      </div>

      <div class="space-y-2">
        <Label>Machine / Area</Label>
        <div class="grid grid-cols-2 gap-2">
          {#each LAUNDRY_MACHINES as m}
            <Button
              type="button"
              variant={newReservation.machine === m.value ? "default" : "outline"}
              size="default"
              class="h-10 text-sm font-medium"
              onclick={() => (newReservation.machine = m.value)}
            >
              {m.label}
            </Button>
          {/each}
        </div>
      </div>
      {#if validationError}
        <div class="flex items-center gap-2 px-1 text-xs font-bold text-destructive uppercase">
          <CircleXIcon class="h-4 w-4" />
          {validationError}
        </div>
      {/if}
    </div>
    <ResponsiveDialog.Footer class="grid grid-cols-2 gap-2 md:flex">
      <ResponsiveDialog.Close>
        <Button variant="outline" class="w-full" disabled={isLoading}>Cancel</Button>
      </ResponsiveDialog.Close>
      <Button onclick={handleBook} {isLoading} disabled={!!validationError}>Confirm</Button>
    </ResponsiveDialog.Footer>
  </ResponsiveDialog.Content>
</ResponsiveDialog.Root>
