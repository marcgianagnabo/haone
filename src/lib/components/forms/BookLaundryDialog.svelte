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
  import { Combobox } from "$ui/combobox";
  import {
    DEFAULT_LAUNDRY_MACHINE,
    LAUNDRY_MACHINES,
    LaundryStatus,
    type LaundryMachineValue,
    type LaundryRecord
  } from "$lib/types";
  import { formatTime } from "$utils/formatters";
  import {
    LAUNDRY_BUFFER_MINUTES,
    LAUNDRY_SLOT_MINUTES,
    buildLaundrySlots,
    formatSlotMinutes,
    getAdminLaundryGrid,
    getLaundryGrid,
    minutesToHHMM,
    type LaundryGrid
  } from "$utils/laundry-slots";
  import { parseTime, parseTimeMinutes } from "$utils/parsers";
  import { CircleXIcon } from "@lucide/svelte";
  import { toast } from "svelte-sonner";
  import { settings } from "$state/settings.svelte";

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

  // Fixed-slot grid loaded once per dialog open (never per render):
  // residents use per-instance hours, admins use the 24-hour grid.
  let grid = $state<LaundryGrid | null>(null);
  let gridLoading = $state(false);

  const targetUserId = $derived(isAdmin ? newReservation.residentId : myResidentId);

  // 2h/day guard: one fixed slot fills the day. Active bookings only;
  // cancelled bookings free the day. Machine-agnostic (any time/machine).
  const userDayMinutes = $derived.by(() => {
    const uid = targetUserId;
    if (!uid) return 0;
    return (reservations || [])
      .filter(
        (r: LaundryRecord) =>
          r.status === "ACTIVE" && r.date === newReservation.date && r.residentId === uid
      )
      .reduce((total, r) => {
        const s = parseTimeMinutes(r.timeStart);
        const e = parseTimeMinutes(r.timeEnd);
        if (!isNaN(s) && !isNaN(e) && e > s) return total + (e - s);
        return total;
      }, 0);
  });
  const dayIsFull = $derived(userDayMinutes >= LAUNDRY_SLOT_MINUTES);

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

  async function ensureGrid() {
    if (grid || gridLoading) {
      return;
    }
    if (isAdmin) {
      grid = getAdminLaundryGrid();
      return;
    }
    gridLoading = true;
    try {
      grid = await getLaundryGrid();
    } catch {
      grid = null;
    } finally {
      gridLoading = false;
    }
  }

  // Strip any :SS residue (native pickers / DB time columns) -> HH:MM.
  function normalizeHHMM(v: string): string {
    const m = parseTimeMinutes(v || "");
    if (!Number.isFinite(m) || m < 0) return "05:00";
    return minutesToHHMM(Math.max(0, Math.min(1439, m)));
  }

  // Duration is fixed to 2 hours for all roles (no 1hr/custom).

  // Buffer-aware clash, called only on click/book paths (never per render).
  function isSlotTaken(date: string, startMin: number, endMin: number, machine: string): boolean {
    return reservations.some((r: LaundryRecord) => {
      if (r.status !== "ACTIVE" || r.date !== date) return false;
      if ((r.machine || DEFAULT_LAUNDRY_MACHINE) !== machine) return false;
      const s = parseTimeMinutes(r.timeStart);
      const e = parseTimeMinutes(r.timeEnd);
      if (isNaN(s) || isNaN(e)) return false;
      return startMin < e + LAUNDRY_BUFFER_MINUTES && endMin + LAUNDRY_BUFFER_MINUTES > s;
    });
  }

  function isHourlyOccupied(date: string, hour: number, machine?: LaundryMachineValue) {
    return reservations.some((r: LaundryRecord) => {
      if (r.status !== "ACTIVE" || r.date !== date) return false;
      if (machine && (r.machine || DEFAULT_LAUNDRY_MACHINE) !== machine) return false;
      const start = parseTime(r.timeStart);
      const end = parseTime(r.timeEnd);
      return hour >= start && hour < end;
    });
  }

  // Resolve a clicked calendar hour to its fixed 2h slot (e.g. 8AM -> 07:30).
  // Runs once per click, never per render.
  function resolveSlotForHour(
    hour: number,
    g: LaundryGrid | null
  ): { start: number; end: number } | null {
    const fallback = g ?? (isAdmin ? buildLaundrySlots(0, 1440) : buildLaundrySlots(300, 1350));
    const cellStart = hour * 60;
    const cellEnd = cellStart + 60;
    for (const s of fallback.slots) {
      if (s.start < cellEnd && s.end > cellStart) {
        return s;
      }
    }
    return null;
  }

  const validationError = $derived.by(() => {
    if (gridLoading && !grid) {
      return "Loading available slots…";
    }
    if (dayIsFull) {
      return "Only one booking per day allowed — try the next day";
    }
    return validateLaundryReservation({
      date: newReservation.date,
      timeStart: normalizeHHMM(newReservation.timeStart),
      timeEnd: normalizeHHMM(newReservation.timeEnd),
      residentId: targetUserId,
      isAdmin,
      machine: newReservation.machine,
      existingReservations: reservations,
      grid: grid ?? undefined
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
          timeStart: formatTime(normalizeHHMM(newReservation.timeStart)),
          timeEnd: formatTime(normalizeHHMM(newReservation.timeEnd)),
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

  export function open() {
    isDialogOpen = true;
    resolveMyResidentId();
    void ensureGrid();
  }

  // Admin-base signature (date, hour): snap the hour to its fixed slot once,
  // then End is always Start + 2h. No slot-button list is rendered.
  export function handleSelectSlot(date: string, hour: number, machine?: LaundryMachineValue) {
    newReservation.date = date;
    const apply = (g: LaundryGrid | null) => {
      const slot = resolveSlotForHour(hour, g);
      const startMin = slot ? slot.start : hour * 60;
      const endMin = startMin + LAUNDRY_SLOT_MINUTES;
      if (machine && !isSlotTaken(date, startMin, endMin, machine)) {
        newReservation.machine = machine;
      } else {
        const firstFree = LAUNDRY_MACHINES.find(
          (m) => !isSlotTaken(date, startMin, endMin, m.value)
        );
        if (firstFree) {
          newReservation.machine = firstFree.value;
        } else if (machine) {
          newReservation.machine = machine;
        } else if (!isSlotTaken(date, startMin, endMin, newReservation.machine)) {
          // keep current machine
        } else {
          const hourlyFree = LAUNDRY_MACHINES.find((m) => !isHourlyOccupied(date, hour, m.value));
          if (hourlyFree) newReservation.machine = hourlyFree.value;
        }
      }
      if (!isSlotTaken(date, startMin, endMin, newReservation.machine)) {
        newReservation.timeStart = minutesToHHMM(startMin);
        newReservation.timeEnd = minutesToHHMM(Math.min(endMin, 1440));
      } else {
        toast.error("This machine slot is already booked.");
      }
    };
    if (grid) {
      apply(grid);
    } else if (isAdmin) {
      const g = getAdminLaundryGrid();
      grid = g;
      apply(g);
    } else {
      void ensureGrid().then(() => apply(grid));
    }
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

      <div class="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <div
          class="flex items-center justify-between rounded-lg border border-border bg-muted/30 px-4 py-3 text-sm"
          aria-label="Start time (fixed, not editable)"
        >
          <span class="font-medium text-muted-foreground">Start Time</span>
          <span class="font-semibold text-foreground"
            >{formatSlotMinutes(
              parseTimeMinutes(normalizeHHMM(newReservation.timeStart)),
              settings.clockFormat
            )}</span
          >
        </div>
        <div
          class="flex items-center justify-between rounded-lg border border-border bg-muted/30 px-4 py-3 text-sm"
          aria-label="End time (fixed, not editable)"
        >
          <span class="font-medium text-muted-foreground">End Time</span>
          <span class="font-semibold text-foreground"
            >{formatSlotMinutes(
              parseTimeMinutes(normalizeHHMM(newReservation.timeEnd)),
              settings.clockFormat
            )}</span
          >
        </div>
      </div>
      <p class="text-xs text-muted-foreground">Duration: 2 Hours (fixed).</p>

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
      {#if dayIsFull}
        <p class="px-1 text-xs text-muted-foreground">
          You already have a booking this day — try the next day.
        </p>
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
