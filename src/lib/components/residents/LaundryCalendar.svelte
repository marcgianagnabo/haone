<script lang="ts">
  import type { LaundryRecord, UserRecord } from "$lib/types";
  import { DEFAULT_LAUNDRY_MACHINE, LAUNDRY_MACHINES } from "$lib/types";
  import { cn } from "$lib/utils";
  import {
    ChevronLeft,
    ChevronRight,
    ChevronDown,
    BookmarkIcon,
    CalendarIcon
  } from "@lucide/svelte";
  import * as DropdownMenu from "$ui/dropdown-menu";
  import * as Tooltip from "$ui/tooltip";
  import { Button } from "$ui/button";
  import { parseTime } from "$utils/parsers";
  import { formatTimeRange, laundryMachineLabel } from "$utils/formatters";
  import { settings } from "$state/settings.svelte";
  import ViewLaundryDialog from "$components/forms/ViewLaundryDialog.svelte";
  import { twMerge } from "tailwind-merge";
  import LaundryReservationHistory from "./LaundryReservationHistory.svelte";

  let {
    reservations,
    deprecatedMappedReservations,
    users = [],
    currentUserId = "",
    isAdminView = false,
    canSeeNames = true,
    onSelectSlot,
    onCancelReservation
  }: {
    reservations: LaundryRecord[];
    deprecatedMappedReservations: LaundryRecord[];
    users: (UserRecord & { room?: string })[];
    currentUserId?: string;
    isAdminView?: boolean;
    canSeeNames?: boolean;
    onSelectSlot?: (date: string, hour: number, machine?: string) => void;
    onCancelReservation?: (id: string) => void;
  } = $props();

  let selectedDate = $state(new Date());
  let viewMode = $state<"month" | "week" | "day" | "history">(settings.calendarView || "week");
  let machineFilter = $state<"ALL" | (typeof LAUNDRY_MACHINES)[number]["value"]>("ALL");

  const activeMachineFilter = $derived(machineFilter === "ALL" ? "" : machineFilter);

  const startHour = 0;
  const opStartHour = 5;
  const opEndHour = 22; // Operating hours: 5 AM - 10 PM (last slot 9 PM - 10 PM, hour 21)
  const hours = Array.from({ length: 24 }, (_, i) => i);

  let now = $state(new Date());

  $effect(() => {
    const timer = setInterval(() => {
      now = new Date();
    }, 60000); // Update every minute
    return () => clearInterval(timer);
  });

  const currentTimeIndicator = $derived.by(() => {
    const currentH = now.getHours();
    const currentM = now.getMinutes();
    const currentTotalMinutes = currentH * 60 + currentM;
    const totalGridMinutes = hours.length * 60;

    if (currentTotalMinutes < 0 || currentTotalMinutes >= totalGridMinutes) {
      return null;
    }

    // Position in pixels from the top of the hour grid (Row 2 onwards)
    return { top: currentTotalMinutes };
  });

  const weekDays = $derived.by(() => {
    if (viewMode === "day") {
      const d = new Date(selectedDate);
      d.setHours(0, 0, 0, 0);
      return [d];
    }
    const days = [];
    const start = new Date(selectedDate);
    start.setDate(start.getDate() - start.getDay()); // Start from Sunday
    for (let i = 0; i < 7; i++) {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      d.setHours(0, 0, 0, 0);
      days.push(d);
    }
    return days;
  });

  const monthWeeks = $derived.by(() => {
    const year = selectedDate.getFullYear();
    const month = selectedDate.getMonth();
    const firstDayOfMonth = new Date(year, month, 1);
    const startSunday = new Date(firstDayOfMonth);
    startSunday.setDate(firstDayOfMonth.getDate() - firstDayOfMonth.getDay());
    startSunday.setHours(0, 0, 0, 0);

    const weeks: Date[][] = [];
    const curr = new Date(startSunday);
    while (true) {
      const week: Date[] = [];
      for (let i = 0; i < 7; i++) {
        week.push(new Date(curr));
        curr.setDate(curr.getDate() + 1);
      }
      weeks.push(week);
      if (curr.getMonth() !== month && curr.getDay() === 0) {
        break;
      }
    }
    return weeks;
  });

  const userMap = $derived(
    new Map(
      users.flatMap((u: any) => {
        // Handle both UserRecord (u.id, u.displayName) and ResidentRecord (u.residentId, u.name)
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

  function formatDate(d: Date) {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  const reservationsByDate = $derived.by(() => {
    const map = new Map<string, LaundryRecord[]>();
    for (const r of reservations) {
      if (r.status !== "ACTIVE") continue;
      const list = map.get(r.date) || [];
      list.push(r);
      map.set(r.date, list);
    }
    return map;
  });

  // Machines occupied for a given date/hour slot (e.g. "LEFT_WING").
  function machinesOccupiedAt(dateStr: string, hour: number): Set<string> {
    const occupied = new Set<string>();
    for (const r of reservations) {
      if (r.status !== "ACTIVE" || r.date !== dateStr) continue;
      const start = parseTime(r.timeStart);
      const end = parseTime(r.timeEnd);
      if (hour < end && hour + 1 > start) {
        occupied.add(r.machine || DEFAULT_LAUNDRY_MACHINE);
      }
    }
    return occupied;
  }

  // A slot is unavailable when the filtered machine is taken, or — in the
  // all-machines view — when every machine is taken at that time.
  function isSlotOccupied(dateStr: string, hour: number): boolean {
    const occupied = machinesOccupiedAt(dateStr, hour);
    if (activeMachineFilter) {
      return occupied.has(activeMachineFilter);
    }
    return LAUNDRY_MACHINES.every((m) => occupied.has(m.value));
  }

  function getActiveReservationsForDay(date: string) {
    return (reservationsByDate.get(date) || [])
      .filter((r: LaundryRecord) => {
        if (!activeMachineFilter) return true;
        return (r.machine || DEFAULT_LAUNDRY_MACHINE) === activeMachineFilter;
      })
      .map((r: LaundryRecord) => {
        const start = parseTime(r.timeStart);
        const end = parseTime(r.timeEnd);
        const resId = (r.residentId || "").trim();
        // Lookup by ID (UUID) or email (legacy)
        const user = userMap.get(resId) || userMap.get(resId.toLowerCase());

        const isMine = resId === currentUserId;
        const rawName = (user as any)?.name || r.displayName || "Resident";
        const rawRoom = (user as any)?.room || r.room || "";

        return {
          ...r,
          machine: r.machine || DEFAULT_LAUNDRY_MACHINE,
          machineLabel: laundryMachineLabel(r.machine),
          startHour: start,
          endHour: end,
          duration: end - start,
          name: !canSeeNames && !isMine ? "Reserved" : rawName,
          room: !canSeeNames && !isMine ? "" : rawRoom
        };
      })
      .sort((a, b) => {
        return a.startHour - b.startHour;
      });
  }

  // In the All-machines view, same-time bookings on different machines are
  // rendered side-by-side (50/50 lanes, ordered by machine). Non-overlapping
  // bookings keep the full column width.
  function computeOverlapLanes(dayReservations: ReturnType<typeof getActiveReservationsForDay>) {
    const lanes = new Map<string, { leftPct: number; widthPct: number }>();
    if (activeMachineFilter) {
      for (const r of dayReservations) {
        lanes.set(r.id, { leftPct: 0, widthPct: 100 });
      }
      return lanes;
    }

    const hasOverlap = (r: (typeof dayReservations)[number]) =>
      dayReservations.some(
        (o) => o.id !== r.id && r.startHour < o.endHour && o.startHour < r.endHour
      );

    for (const r of dayReservations) {
      if (!hasOverlap(r)) {
        lanes.set(r.id, { leftPct: 0, widthPct: 100 });
      }
    }
    for (const r of dayReservations) {
      if (!hasOverlap(r)) continue;
      const machineIdx = LAUNDRY_MACHINES.findIndex((m) => m.value === r.machine);
      const lane = machineIdx >= 0 ? machineIdx : 0;
      lanes.set(r.id, { leftPct: lane * 50, widthPct: 50 });
    }
    return lanes;
  }

  function next() {
    const d = new Date(selectedDate);
    if (viewMode === "month") {
      d.setMonth(d.getMonth() + 1);
    } else if (viewMode === "week") {
      d.setDate(d.getDate() + 7);
    } else {
      d.setDate(d.getDate() + 1);
    }
    selectedDate = d;
  }

  function prev() {
    const d = new Date(selectedDate);
    if (viewMode === "month") {
      d.setMonth(d.getMonth() - 1);
    } else if (viewMode === "week") {
      d.setDate(d.getDate() - 7);
    } else {
      d.setDate(d.getDate() - 1);
    }
    selectedDate = d;
  }

  function goToToday() {
    selectedDate = new Date();
  }

  let viewLaundryDialog = $state<ViewLaundryDialog | null>(null);
  function handleReservationClick(res: any) {
    viewLaundryDialog?.open(res);
  }

  const legendItems = [
    { color: "bg-brand", label: "My Reservation" },
    { color: "bg-emerald-700 dark:bg-emerald-900", label: "Others" },
    { color: "bg-emerald-100 dark:bg-emerald-950", label: "Past" },
    { color: "border-dashed", label: "Available" },
    {
      color:
        "bg-muted/40 bg-[repeating-linear-gradient(45deg,transparent,transparent_2px,var(--color-border)_2px,var(--color-border)_3px)] opacity-50",
      label: "Closed"
    }
  ];
</script>

{#snippet headerMain()}
  <Tooltip.Root>
    <Tooltip.Trigger>
      <Button
        variant="secondary"
        size="icon"
        class="h-8 w-8 rounded-full"
        onclick={goToToday}
        aria-label="Today"
      >
        <CalendarIcon class="h-4 w-4" />
      </Button>
    </Tooltip.Trigger>
    <Tooltip.Content side="bottom">
      <p>Today</p>
    </Tooltip.Content>
  </Tooltip.Root>

  <Tooltip.Root>
    <Tooltip.Trigger>
      <Button
        variant="secondary"
        size="icon"
        class="h-8 w-8 rounded-full"
        onclick={prev}
        aria-label={viewMode === "month"
          ? "Previous month"
          : viewMode === "week"
            ? "Previous week"
            : "Previous day"}
      >
        <ChevronLeft class="h-4 w-4" />
      </Button>
    </Tooltip.Trigger>
    <Tooltip.Content side="bottom">
      <p>
        {viewMode === "month"
          ? "Previous month"
          : viewMode === "week"
            ? "Previous week"
            : "Previous day"}
      </p>
    </Tooltip.Content>
  </Tooltip.Root>

  <Tooltip.Root>
    <Tooltip.Trigger>
      <Button
        variant="secondary"
        size="icon"
        class="h-8 w-8 rounded-full"
        onclick={next}
        aria-label={viewMode === "month"
          ? "Next month"
          : viewMode === "week"
            ? "Next week"
            : "Next day"}
      >
        <ChevronRight class="h-4 w-4" />
      </Button>
    </Tooltip.Trigger>
    <Tooltip.Content side="bottom">
      <p>
        {viewMode === "month" ? "Next month" : viewMode === "week" ? "Next week" : "Next day"}
      </p>
    </Tooltip.Content>
  </Tooltip.Root>
{/snippet}

{#snippet headerSwitcher()}
  <DropdownMenu.Root>
    <DropdownMenu.Trigger>
      {#snippet child({ props })}
        <Button
          variant="secondary"
          size="sm"
          class="h-9 rounded-full"
          icon={ChevronDown}
          iconPosition="right"
          {...props}
        >
          <span class="capitalize">{viewMode}</span>
        </Button>
      {/snippet}
    </DropdownMenu.Trigger>
    <DropdownMenu.Content align="end" class="w-32 rounded-xl">
      <DropdownMenu.Item onclick={() => (viewMode = "day")}>Day</DropdownMenu.Item>
      <DropdownMenu.Item onclick={() => (viewMode = "week")}>Week</DropdownMenu.Item>
      <DropdownMenu.Item onclick={() => (viewMode = "month")}>Month</DropdownMenu.Item>
      <DropdownMenu.Item onclick={() => (viewMode = "history")}>History</DropdownMenu.Item>
    </DropdownMenu.Content>
  </DropdownMenu.Root>
{/snippet}

{#snippet machineSwitcher()}
  <div class="flex flex-wrap items-center gap-1.5">
    <Button
      type="button"
      variant={machineFilter === "ALL" ? "default" : "outline"}
      size="sm"
      class="h-9 rounded-full"
      onclick={() => (machineFilter = "ALL")}
    >
      All Machines
    </Button>
    {#each LAUNDRY_MACHINES as m}
      <Button
        type="button"
        variant={machineFilter === m.value ? "default" : "outline"}
        size="sm"
        class="h-9 rounded-full"
        onclick={() => (machineFilter = m.value)}
      >
        {m.label}
      </Button>
    {/each}
  </div>
{/snippet}

{#snippet legend()}
  <div class="flex flex-wrap items-center gap-4 text-xs font-semibold tracking-widest uppercase">
    {#each legendItems as item}
      <div class="flex items-center gap-1.5">
        <div
          class={twMerge("h-5 w-5 rounded-xl border-2 border-black dark:border-white", item.color)}
        ></div>
        <span>{item.label}</span>
      </div>
    {/each}
  </div>
{/snippet}

{#snippet calendar()}
  <div class="overflow-x-auto">
    <div class={cn(viewMode === "week" ? "min-w-200" : "w-full")}>
      <!-- Unified Grid Container -->
      <div
        class={cn(
          "relative grid overflow-hidden rounded-xl border bg-background",
          viewMode === "week" ? "grid-cols-[60px_repeat(7,1fr)]" : "grid-cols-[60px_1fr]"
        )}
        style="grid-template-rows: 80px repeat({hours.length}, 60px);"
      >
        <!-- Header -->
        <div
          class="flex items-center justify-center border-b bg-muted/30 p-2 text-xs font-semibold text-muted-foreground uppercase"
          style="grid-row: 1; grid-column: 1;"
        >
          Time
        </div>
        {#each weekDays as day, dayIdx}
          <div
            class="space-y-1 border-b border-l bg-muted/30 p-2 text-center"
            style="grid-row: 1; grid-column: {dayIdx + 2};"
          >
            <div
              class={cn(
                "text-xs font-semibold tracking-tight uppercase",
                formatDate(day) === formatDate(now) ? "text-primary" : "text-muted-foreground"
              )}
            >
              {day.toLocaleDateString(undefined, { weekday: "short" })}
            </div>
            <div
              class={cn(
                "mx-auto flex h-10 w-10 items-center justify-center rounded-full text-2xl font-medium transition-colors",
                formatDate(day) === formatDate(now)
                  ? "bg-primary font-bold text-primary-foreground shadow-sm"
                  : "hover:bg-muted"
              )}
            >
              {day.getDate()}
            </div>
          </div>
        {/each}

        <!-- Grid Body -->
        {#each hours as hour, hourIdx}
          {@const isLastRow = hourIdx === hours.length - 1}
          <!-- Time Label -->
          <div
            class={cn(
              "relative flex justify-end bg-muted/5 p-0 text-xs font-bold text-muted-foreground uppercase",
              !isLastRow && "border-b"
            )}
            style="grid-row: {hourIdx + 2}; grid-column: 1;"
          >
            {#if hour !== 0}
              <span
                class="absolute inset-x-0 top-0 z-20 flex -translate-y-1/2 items-center justify-center"
              >
                <span class="bg-background px-1 text-muted-foreground">
                  {settings.clockFormat === "12h"
                    ? `${hour % 12 || 12} ${hour >= 12 ? "PM" : "AM"}`
                    : `${hour.toString().padStart(2, "0")}:00`}
                </span>
              </span>
            {/if}
          </div>

          {#each weekDays as day, dayIdx}
            {@const dateStr = formatDate(day)}
            {@const isOutsideHours = hour < opStartHour || hour >= opEndHour}
            {@const isBlocked = !isAdminView && isOutsideHours}
            {@const isSlotOccupiedByMachine = isSlotOccupied(dateStr, hour)}
            <!-- Slot Button (Background) -->
            <button
              type="button"
              class={cn(
                "h-15 w-full rounded-none border-l p-0 transition-colors",
                !isLastRow && "border-b",
                isBlocked
                  ? "cursor-not-allowed bg-muted/40 bg-[repeating-linear-gradient(45deg,transparent,transparent_6px,var(--color-border)_6px,var(--color-border)_7px)] opacity-50"
                  : isOutsideHours
                    ? "bg-muted/10 enabled:cursor-pointer enabled:hover:bg-muted/30 disabled:cursor-not-allowed disabled:bg-muted/5"
                    : "bg-transparent enabled:cursor-pointer enabled:hover:bg-muted/30 disabled:cursor-not-allowed disabled:bg-muted/5"
              )}
              style="grid-row: {hourIdx + 2}; grid-column: {dayIdx + 2};"
              disabled={isBlocked ||
                isSlotOccupiedByMachine ||
                (isAdminView
                  ? false
                  : day.getFullYear() === now.getFullYear() &&
                      day.getMonth() === now.getMonth() &&
                      day.getDate() === now.getDate()
                    ? hour < now.getHours()
                    : day < now)}
              onclick={() => onSelectSlot?.(dateStr, hour, activeMachineFilter || undefined)}
              aria-label="Select slot for {dateStr} at {hour}:00"
            ></button>
          {/each}
        {/each}

        {#each weekDays as day, dayIdx}
          {@const isToday = formatDate(day) === formatDate(now)}
          <div
            class="pointer-events-none relative"
            style="grid-row: 2 / span {hours.length}; grid-column: {dayIdx + 2};"
          >
            {#if isToday && currentTimeIndicator}
              <div
                class="absolute z-30 flex w-full items-center"
                style="top: {currentTimeIndicator.top}px; left: 0; right: 0;"
              >
                <div
                  class="absolute left-0 h-3 w-3 -translate-x-1/2 rounded-full bg-red-500 shadow-sm"
                ></div>
                <div class="h-0.5 w-full bg-red-500 shadow-sm"></div>
              </div>
            {/if}
          </div>
        {/each}

        <!-- Actual Reservations (Overlaid) -->
        {#each weekDays as day, dayIdx}
          {@const dateStr = formatDate(day)}
          {@const dayReservations = getActiveReservationsForDay(dateStr)}
          {@const lanes = computeOverlapLanes(dayReservations)}
          <div
            class="pointer-events-none relative"
            style="grid-row: 2 / span {hours.length}; grid-column: {dayIdx + 2};"
          >
            {#each dayReservations as res}
              {@const lane = lanes.get(res.id) || { leftPct: 0, widthPct: 100 }}
              {@const startMin = (res.startHour - startHour) * 60}
              {@const durationMin = res.duration * 60}
              {@const isMine = res.residentId === currentUserId}
              {@const resEndTime = day.getTime() + res.endHour * 3600000}
              {@const isPast = resEndTime <= now.getTime()}
              {#if durationMin > 0}
                <button
                  type="button"
                  class={cn(
                    "pointer-events-auto absolute z-10 flex cursor-pointer flex-col justify-center overflow-hidden rounded-md border-0 p-2 text-left transition-all",
                    isPast
                      ? "bg-emerald-100 dark:bg-emerald-950"
                      : isMine
                        ? "bg-brand"
                        : "bg-emerald-700 dark:bg-emerald-900"
                  )}
                  style="top: {startMin + 3}px; height: {Math.max(
                    durationMin - 6,
                    24
                  )}px; left: calc({lane.leftPct}% + 4px); width: calc({lane.widthPct}% - 6px);"
                  onclick={() => handleReservationClick(res)}
                >
                  <div
                    class={cn(
                      "flex w-full min-w-0 items-center gap-1 text-sm leading-none font-semibold",
                      isPast ? "text-muted-foreground" : "text-white"
                    )}
                  >
                    {#if isMine}
                      <BookmarkIcon class="h-3.5 w-3.5 shrink-0" />
                    {/if}
                    <span class="truncate">{res.name}</span>
                  </div>
                  <div
                    class={cn(
                      "mt-1 flex w-full items-center gap-1 text-[10px] font-semibold tracking-wider uppercase",
                      isPast ? "text-muted-foreground" : "text-white/90"
                    )}
                  >
                    <span class="truncate">{res.machineLabel}</span>
                  </div>
                  {#if res.room}
                    <div
                      class={cn(
                        "mt-0.5 text-xs tracking-wider uppercase",
                        isPast ? "text-muted-foreground" : "text-white"
                      )}
                    >
                      {res.room}
                    </div>
                  {/if}
                </button>
              {/if}
            {/each}
          </div>
        {/each}
      </div>
    </div>
  </div>

  {@render legend()}
{/snippet}

{#snippet monthCalendar()}
  <div class="overflow-x-auto">
    <div class="min-w-200">
      <div class="overflow-hidden rounded-xl border bg-background">
        <!-- Day-of-week header -->
        <div class="grid grid-cols-7 border-b bg-muted/30 text-center">
          {#each ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as dayLabel}
            <div class="p-2 text-xs font-semibold tracking-wider text-muted-foreground uppercase">
              {dayLabel}
            </div>
          {/each}
        </div>

        <!-- Month Grid (weeks x 7 days) -->
        <div class="grid grid-cols-7 divide-x divide-y border-t border-muted/30">
          {#each monthWeeks as week}
            {#each week as day}
              {@const dateStr = formatDate(day)}
              {@const isCurrentMonth = day.getMonth() === selectedDate.getMonth()}
              {@const isToday = dateStr === formatDate(now)}
              {@const dayReservations = getActiveReservationsForDay(dateStr)}
              {@const maxVisible = 3}
              {@const remainingCount = dayReservations.length - maxVisible}
              <div
                class={cn(
                  "flex min-h-32 flex-col p-2 transition-colors",
                  !isCurrentMonth && "bg-muted/10 opacity-40",
                  isCurrentMonth && "hover:bg-muted/5"
                )}
              >
                <!-- Day Header -->
                <div class="flex items-center justify-between pb-1">
                  <button
                    type="button"
                    class={cn(
                      "flex h-7 w-7 items-center justify-center rounded-full text-xs font-medium transition-colors hover:bg-muted",
                      isToday && "bg-primary font-bold text-primary-foreground hover:bg-primary/90"
                    )}
                    onclick={() => {
                      selectedDate = day;
                      viewMode = "day";
                    }}
                    title="View day"
                  >
                    {day.getDate()}
                  </button>

                  {#if onSelectSlot && isCurrentMonth}
                    <button
                      type="button"
                      class="text-[10px] font-semibold text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-primary focus:opacity-100"
                      onclick={() => onSelectSlot?.(dateStr, opStartHour)}
                    >
                      + Book
                    </button>
                  {/if}
                </div>

                <!-- Reservations List -->
                <div class="flex flex-1 flex-col gap-1 overflow-hidden">
                  {#each dayReservations.slice(0, maxVisible) as res}
                    {@const isMine = res.residentId === currentUserId}
                    {@const resEndTime = day.getTime() + res.endHour * 3600000}
                    {@const isPast = resEndTime <= now.getTime()}
                    <button
                      type="button"
                      class={cn(
                        "flex w-full items-center gap-1 rounded px-1.5 py-0.5 text-left text-xs transition-all",
                        isPast
                          ? "bg-emerald-100 text-muted-foreground dark:bg-emerald-950"
                          : isMine
                            ? "bg-brand text-white"
                            : "bg-emerald-700 text-white dark:bg-emerald-900"
                      )}
                      onclick={() => handleReservationClick(res)}
                    >
                      {#if isMine}
                        <BookmarkIcon class="h-3 w-3 shrink-0" />
                      {/if}
                      <span class="flex-1 truncate font-medium">
                        {formatTimeRange(`${res.timeStart}-${res.timeEnd}`, settings.clockFormat)}
                      </span>
                      <span
                        class="w-16 shrink truncate font-semibold tracking-wide uppercase opacity-75"
                      >
                        {res.machineLabel}
                      </span>
                      <span class="flex-2 truncate">
                        {res.name}
                      </span>
                    </button>
                  {/each}

                  {#if remainingCount > 0}
                    <button
                      type="button"
                      class="mt-auto text-left text-xs font-medium text-muted-foreground hover:text-foreground"
                      onclick={() => {
                        selectedDate = day;
                        viewMode = "day";
                      }}
                    >
                      {remainingCount} more
                    </button>
                  {/if}
                </div>
              </div>
            {/each}
          {/each}
        </div>
      </div>
    </div>
  </div>

  {@render legend()}
{/snippet}

<div class="flex flex-col gap-4">
  <div class="flex items-center justify-between">
    <div class="flex min-w-0 items-center gap-2">
      {#if viewMode !== "history"}
        {@render headerMain()}
      {/if}
      <h2 class="h2-base truncate">
        {#if viewMode === "history"}
          Reservation History
        {:else}
          {selectedDate.toLocaleDateString(undefined, { month: "long", year: "numeric" })}
        {/if}
      </h2>
    </div>

    <div class="flex items-center gap-2">
      {@render headerSwitcher()}
    </div>
  </div>

  {#if viewMode === "history"}
    <LaundryReservationHistory
      reservations={deprecatedMappedReservations}
      isAdmin={isAdminView}
      onRowClick={(row) => handleReservationClick(row)}
    />
  {:else}
    {@render machineSwitcher()}
    {#if viewMode === "month"}
      {@render monthCalendar()}
    {:else}
      {@render calendar()}
    {/if}
  {/if}
</div>

<ViewLaundryDialog
  bind:this={viewLaundryDialog}
  {currentUserId}
  {isAdminView}
  {onCancelReservation}
/>
