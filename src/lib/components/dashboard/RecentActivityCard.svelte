<script lang="ts">
  import { onMount } from "svelte";
  import * as Card from "$ui/card";
  import { Button } from "$ui/button";
  import {
    ArrowRight,
    TrendingUp,
    TrendingDown,
    RotateCcwClockIcon,
    WashingMachine,
    Calendar,
    Clock,
    WalletIcon,
    ShieldCheckIcon,
    MapPinIcon
  } from "@lucide/svelte";
  import { formatCurrency, formatDate, formatTimeRange, laundryMachineLabel } from "$utils/formatters";
  import { parseTime } from "$utils/parsers";
  import { translateTransactionType } from "$utils/translators";
  import { fetchLaundryReservations } from "$api/controllers/laundry-controller";
  import { fetchUsers } from "$api/controllers/resident-controller";
  import { AccountType, type LaundryRecord, type UserRecord } from "$lib/types";
  import { auth } from "$state/auth.svelte";
  import { settings } from "$state/settings.svelte";
  import ActivityItem from "$components/dashboard/ActivityItem.svelte";
  import Skeleton from "$components/ui/skeleton/skeleton.svelte";
  import type { ResidentStatus } from "$state/resident-state.svelte";
  import StatusBadge from "$components/residents/StatusBadge.svelte";

  let {
    status = null
  }: {
    status?: ResidentStatus | null;
  } = $props();

  const transactions = $derived(status?.transactions || []);
  const period = $derived(status?.activeTerm || "");

  const filteredTransactions = $derived(
    transactions.filter((t: any) => t.period === period).slice(0, 5)
  );

  let reservations = $state<LaundryRecord[]>([]);
  let users = $state<UserRecord[]>([]);
  let currentResidentId = $state("");
  let isLaundryLoading = $state(true);

  const residentId = $derived(currentResidentId || auth.userId);

  async function loadLaundry() {
    try {
      const [resResult, userData] = await Promise.all([
        fetchLaundryReservations().catch(() => ({ reservations: [], currentResidentId: "" })),
        fetchUsers().catch(() => [])
      ]);

      if (Array.isArray(resResult)) {
        reservations = resResult;
      } else if (resResult?.reservations) {
        reservations = resResult.reservations;
        currentResidentId = resResult.currentResidentId || "";
      }
      users = userData || [];
    } catch {
      // Feature flag disabled or fetch failure
    } finally {
      isLaundryLoading = false;
    }
  }

  onMount(() => {
    loadLaundry();
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
        if (id) {
          entries.push([id, data]);
        }
        if (email) {
          entries.push([(email || "").trim().toLowerCase(), data]);
        }
        return entries;
      })
    )
  );

  function getDisplayName(resId: string, fallbackName?: string) {
    const user = userMap.get(resId) || userMap.get(resId.toLowerCase());
    return user?.name || fallbackName || "Resident";
  }

  function getDisplayRoom(resId: string, fallbackRoom?: string) {
    const user = userMap.get(resId) || userMap.get(resId.toLowerCase());
    return user?.room || fallbackRoom || "";
  }

  function toReservationTimestamp(dateStr: string, hourVal: number) {
    const parts = dateStr.split("-").map(Number);
    const d = new Date(parts[0], parts[1] - 1, parts[2]);
    return d.getTime() + hourVal * 3600000;
  }

  // Find currently active user in laundry area right now
  const currentLaundrySlot = $derived.by(() => {
    const now = new Date();
    const nowMs = now.getTime();

    for (const r of reservations) {
      if (r.status !== "ACTIVE") {
        continue;
      }
      const startH = parseTime(r.timeStart);
      const endH = parseTime(r.timeEnd);
      const startMs = toReservationTimestamp(r.date, startH);
      const endMs = toReservationTimestamp(r.date, endH);

      if (nowMs >= startMs && nowMs < endMs) {
        const resId = (r.residentId || "").trim();
        const isMine = resId === residentId;
        return {
          ...r,
          isMine,
          machineLabel: laundryMachineLabel(r.machine),
          name: isMine ? "You" : getDisplayName(resId, r.displayName),
          room: getDisplayRoom(resId, r.room)
        };
      }
    }
    return null;
  });

  // Find next upcoming reservation for the current user
  const upcomingUserReservation = $derived.by(() => {
    if (!residentId) {
      return null;
    }
    const nowMs = new Date().getTime();

    const upcoming = reservations
      .filter((r) => {
        if (r.status !== "ACTIVE") {
          return false;
        }
        if ((r.residentId || "").trim() !== residentId) {
          return false;
        }
        const startH = parseTime(r.timeStart);
        const startMs = toReservationTimestamp(r.date, startH);
        return startMs > nowMs;
      })
      .sort((a, b) => {
        const startA = toReservationTimestamp(a.date, parseTime(a.timeStart));
        const startB = toReservationTimestamp(b.date, parseTime(b.timeStart));
        return startA - startB;
      });

    return upcoming[0] || null;
  });
</script>

<div class="flex flex-col gap-6">
  <!-- Laundry Activity Card (First) -->
  <div>
    <div class="mb-3 flex flex-row items-center justify-between pb-0">
      <h2 class="h2-base">Laundry Area</h2>
      <Button
        variant="ghost"
        size="sm"
        href="/resident/laundry"
        title="View Calendar"
        icon={ArrowRight}
      />
    </div>

    <Card.Root class="mt-6 overflow-hidden p-0">
      <Card.Content class="divide-y p-0">
        <!-- Current User in Laundry Area -->
        <ActivityItem icon={WashingMachine} iconClass="bg-brand/10 text-brand">
          {#if isLaundryLoading}
            <Skeleton class="h-4 w-1/2" />
          {:else if currentLaundrySlot}
            <p class="text-xs font-semibold uppercase">Current Reservation</p>
            <p class="truncate">
              {currentLaundrySlot.name}
              {#if currentLaundrySlot.room}
                ({currentLaundrySlot.room})
              {/if}
            </p>
            <p class="flex items-center gap-1 text-xs text-muted-foreground">
              <MapPinIcon class="h-3 w-3" />
              {currentLaundrySlot.machineLabel}
            </p>
          {:else}
            <p>Area is currently available</p>
          {/if}

          {#snippet right()}
            {#if currentLaundrySlot}
              <span
                class="inline-flex items-center gap-1 rounded-md bg-emerald-500/10 px-2 py-0.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400"
              >
                <Clock class="h-3 w-3" />
                {formatTimeRange(
                  `${currentLaundrySlot.timeStart}-${currentLaundrySlot.timeEnd}`,
                  settings.clockFormat
                )}
              </span>
            {/if}
          {/snippet}
        </ActivityItem>

        <!-- Next User Reservation -->
        <ActivityItem
          icon={Calendar}
          iconClass={upcomingUserReservation
            ? "bg-blue-500/10 text-blue-600 dark:text-blue-400"
            : "bg-brand/10 text-brand"}
        >
          {#if isLaundryLoading}
            <Skeleton class="h-4 w-1/2" />
          {:else if upcomingUserReservation}
            <p class="text-xs font-semibold uppercase">Your Upcoming Reservation</p>
            <p class="truncate">
              {formatDate(upcomingUserReservation.date)}
            </p>
            <p class="flex items-center gap-1 text-xs text-muted-foreground">
              <MapPinIcon class="h-3 w-3" />
              {laundryMachineLabel(upcomingUserReservation.machine)}
            </p>
          {:else}
            <p>No upcoming reservation</p>
          {/if}

          {#snippet right()}
            {#if upcomingUserReservation}
              <span
                class="inline-flex items-center gap-1 rounded-md bg-blue-500/10 px-2 py-0.5 text-xs font-semibold text-blue-600 dark:text-blue-400"
              >
                <Clock class="h-3 w-3" />
                {formatTimeRange(
                  `${upcomingUserReservation.timeStart}-${upcomingUserReservation.timeEnd}`,
                  settings.clockFormat
                )}
              </span>
            {/if}
          {/snippet}
        </ActivityItem>
      </Card.Content>
    </Card.Root>
  </div>

  <!-- Status -->
  {#if !status || (status.account && status.currEntry?.accountType !== AccountType.ALUMNUS)}
    <div>
      <h2 class="h2-base">Status</h2>
      <Card.Root class="mt-6 overflow-hidden p-0">
        <Card.Content class="divide-y p-0">
          <ActivityItem icon={MapPinIcon} title="Room">
            {#snippet right()}
              {#if status?.account}
                {status.account?.bed
                  ? `${status.account?.room}-${status.account?.bed}`
                  : status.account?.room}
              {:else}
                <Skeleton class="h-4 w-16" />
              {/if}
            {/snippet}
          </ActivityItem>
          <ActivityItem icon={ShieldCheckIcon} title="Payment Status">
            {#snippet right()}
              {#if status?.account}
                <StatusBadge account={status.account} textOnly={true} />
              {:else}
                <Skeleton class="h-4 w-16" />
              {/if}
            {/snippet}
          </ActivityItem>
          <ActivityItem icon={WalletIcon} title="Amount Due">
            {#snippet right()}
              {#if status?.account}
                <p class="font-mono text-sm font-bold text-foreground tabular-nums">
                  {formatCurrency(status.account.bal || 0)}
                </p>
              {:else}
                <Skeleton class="h-4 w-16" />
              {/if}
            {/snippet}
          </ActivityItem>
        </Card.Content>
      </Card.Root>
    </div>
  {/if}

  <!-- Recent Transactions (Second) -->
  {#if filteredTransactions.length > 0}
    <div>
      <div class="mb-3 flex flex-row items-center justify-between pb-0">
        <h2 class="h2-base">Recent Transactions</h2>
        <Button
          variant="ghost"
          size="sm"
          href="/resident/finance"
          title="View All"
          icon={ArrowRight}
        />
      </div>

      <Card.Root class="mt-6 overflow-hidden p-0">
        <Card.Content class="divide-y p-0">
          {#each filteredTransactions as tx}
            {@const Icon =
              tx.amount > 0 ? TrendingUp : tx.amount < 0 ? TrendingDown : RotateCcwClockIcon}
            {@const iconClass =
              tx.amount > 0
                ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                : tx.amount < 0
                  ? "bg-rose-500/10 text-rose-600 dark:text-rose-400"
                  : "bg-brand/5 text-brand"}
            <ActivityItem
              icon={Icon}
              {iconClass}
              title={translateTransactionType(tx.type)}
              subtitle={formatDate(tx.date)}
            >
              {#snippet right()}
                <p class="font-mono text-sm font-bold text-foreground tabular-nums">
                  {formatCurrency(tx.amount)}
                </p>
              {/snippet}
            </ActivityItem>
          {/each}
        </Card.Content>
      </Card.Root>
    </div>
  {/if}
</div>
