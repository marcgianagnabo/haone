<script lang="ts">
  import { LaundryStatus, type LaundryRecord } from "$lib/types";
  import { settings } from "$state/settings.svelte";
  import DataTableColumnHeader from "$ui/data-table/data-table-column-header.svelte";
  import { renderComponent, renderSnippet, type ColumnDef } from "$ui/data-table/index.js";
  import { formatDate, formatTimeRange, laundryMachineLabel } from "$utils/formatters";
  import { parseTime, parseDateWeight } from "$utils/parsers";
  import { createRawSnippet } from "svelte";
  import DataTable from "$ui/data-table/data-table.svelte";
  import * as NativeSelect from "$ui/native-select";
  import FilterDrawer from "$components/content/FilterDrawer.svelte";
  import EmptyView from "$components/content/EmptyView.svelte";
  import { Funnel, CircleX, Plus } from "@lucide/svelte";

  let {
    reservations = [],
    isAdmin = false,
    onRowClick
  }: {
    reservations: LaundryRecord[];
    isAdmin?: boolean;
    onRowClick?: (row: LaundryRecord) => void;
  } = $props();

  let statusFilter = $state<LaundryStatus | "">(LaundryStatus.ACTIVE);

  const columns = $derived.by(() => {
    const cols: ColumnDef<LaundryRecord>[] = [
      {
        accessorKey: "creationTimestamp",
        header: ({ column }) =>
          renderComponent(DataTableColumnHeader, { column, title: "Booking Date" }),
        cell: ({ row }) => {
          const date = formatDate(row.original.creationTimestamp || "");
          const snippet = createRawSnippet<[{ val: string }]>((p) => ({
            render: () => `<span class="font-medium">${p().val}</span>`
          }));
          return renderSnippet(snippet, { val: date });
        }
      }
    ];

    if (isAdmin) {
      cols.push({
        accessorKey: "residentId",
        header: ({ column }) =>
          renderComponent(DataTableColumnHeader, { column, title: "Resident" }),
        cell: ({ row }) => {
          const name =
            row.original.displayName || (row.original as any).name || row.original.residentId;
          const room = row.original.room ? `Room ${row.original.room}` : "";

          const snippet = createRawSnippet<[{ name: string; room: string }]>((p) => ({
            render: () => `
              <div class="flex flex-col">
                <span class="font-medium">${p().name}</span>
                ${p().room ? `<span class="text-muted-foreground">${p().room}</span>` : ""}
              </div>
            `
          }));
          return renderSnippet(snippet, {
            name,
            room
          });
        }
      });
    }

    cols.push(
      {
        accessorKey: "date",
        header: ({ column }) =>
          renderComponent(DataTableColumnHeader, { column, title: "Reservation" }),
        cell: ({ row }) => {
          const date = formatDate(row.original.date);
          const start = row.original.timeStart;
          const end = row.original.timeEnd;

          const snippet = createRawSnippet<[{ date: string; start: string; end: string }]>((p) => ({
            render: () => `
              <div class="flex flex-col">
                <span class="font-medium">${p().date}</span>
                <span>
                  ${formatTimeRange(p().start, settings.clockFormat)}–${formatTimeRange(p().end, settings.clockFormat)}
                </span>
              </div>
            `
          }));
          return renderSnippet(snippet, { date, start, end });
        }
      },
      {
        accessorKey: "machine",
        header: ({ column }) =>
          renderComponent(DataTableColumnHeader, { column, title: "Machine" }),
        cell: ({ row }) => {
          const label = laundryMachineLabel(row.original.machine);
          const snippet = createRawSnippet<[{ label: string }]>((p) => ({
            render: () => `<span class="font-medium">${p().label}</span>`
          }));
          return renderSnippet(snippet, { label });
        }
      },
      {
        id: "status",
        header: ({ column }) => renderComponent(DataTableColumnHeader, { column, title: "Status" }),
        accessorFn: (res) => {
          if ((res as any)._effectiveStatus) {
            return (res as any)._effectiveStatus;
          }

          if (res.status === LaundryStatus.ACTIVE) {
            if (!res.date || !res.timeEnd) {
              return res.status;
            }
            const [y, m, day] = res.date.split("-").map(Number);
            const h = parseTime(res.timeEnd);
            const endDt = new Date(y, m - 1, day, h, 0);
            if (!isNaN(endDt.getTime()) && endDt < new Date()) {
              return LaundryStatus.COMPLETED;
            }
          }
          return res.status;
        },
        cell: ({ row }) => {
          const status = row.getValue("status") as string;
          const reason = row.original.cancelReason;

          const isCancelled = status.startsWith("CANCELLED");
          const isCompleted = status === LaundryStatus.COMPLETED;

          const colorClass =
            status === LaundryStatus.ACTIVE
              ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
              : isCompleted
                ? "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400"
                : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400";

          const snippet = createRawSnippet<[{ status: string; reason: string }]>((p) => ({
            render: () => `
              <div class="flex flex-col gap-1.5">
                <div>
                  <span class="inline-flex items-center rounded-full px-2.5 py-0.5 font-medium ${colorClass}">
                    ${p().status.replace(/_/g, " ")}
                  </span>
                </div>
                ${isCancelled && p().reason ? `<span class="text-muted-foreground italic text-xs leading-tight line-clamp-2">(${p().reason})</span>` : ""}
              </div>
            `
          }));
          return renderSnippet(snippet, { status, reason });
        }
      }
    );

    return cols;
  });

  const filteredReservations = $derived.by(() => {
    return reservations
      .map((r) => {
        let effectiveStatus = r.status;
        if (r.status === LaundryStatus.ACTIVE) {
          if (r.date && r.timeEnd) {
            const [y, m, day] = r.date.split("-").map(Number);
            const h = parseTime(r.timeEnd);
            const endDt = new Date(y, m - 1, day, h, 0);
            if (!isNaN(endDt.getTime()) && endDt < new Date()) {
              effectiveStatus = LaundryStatus.COMPLETED;
            }
          }
        }

        let sortKey = parseDateWeight(r.creationTimestamp);
        if (sortKey === 0) {
          sortKey = parseDateWeight(`${r.date} ${r.timeStart}`);
        }

        return {
          ...r,
          _sortKey: sortKey,
          _effectiveStatus: effectiveStatus
        };
      })
      .filter((r) => !statusFilter || r._effectiveStatus === statusFilter)
      .sort((a, b) => b._sortKey - a._sortKey);
  });

  function handleRowClick(row: LaundryRecord) {
    if (onRowClick) {
      onRowClick(row);
    }
  }
</script>

<div class="space-y-4">
  <FilterDrawer activeCount={Number(statusFilter !== "")}>
    <div class="flex items-center gap-2">
      <Funnel class="h-4 w-4 text-muted-foreground" />
      <NativeSelect.Root bind:value={statusFilter} class="h-9 w-full text-xs sm:w-35">
        <NativeSelect.Option value="">All Status</NativeSelect.Option>
        <NativeSelect.Option value={LaundryStatus.ACTIVE}>Active</NativeSelect.Option>
        <NativeSelect.Option value={LaundryStatus.COMPLETED}>Completed</NativeSelect.Option>
        {#if isAdmin}
          <NativeSelect.Option value={LaundryStatus.CANCELLED_BY_ADMIN}
            >Cancelled (Admin)</NativeSelect.Option
          >
          <NativeSelect.Option value={LaundryStatus.CANCELLED_BY_USER}
            >Cancelled (User)</NativeSelect.Option
          >
        {:else}
          <NativeSelect.Option value={LaundryStatus.CANCELLED_BY_USER}
            >Cancelled (User)</NativeSelect.Option
          >
          <NativeSelect.Option value={LaundryStatus.CANCELLED_BY_ADMIN}
            >Cancelled (Admin)</NativeSelect.Option
          >
        {/if}
      </NativeSelect.Root>
    </div>
  </FilterDrawer>

  {#if reservations.length > 0}
    {#if filteredReservations.length > 0}
      <DataTable data={filteredReservations} {columns} rowId="id" onRowClick={handleRowClick} />
    {:else}
      <EmptyView
        title="No matching reservations"
        description="No reservations match the selected status filter."
      >
        {#snippet icon()}
          <CircleX class="h-10 w-10 text-muted-foreground/40" />
        {/snippet}
      </EmptyView>
    {/if}
  {:else}
    <EmptyView
      title="No reservations found"
      description="Your laundry reservation history will appear here once you start booking slots."
    >
      {#snippet icon()}
        <Plus class="h-10 w-10 text-muted-foreground/40" />
      {/snippet}
    </EmptyView>
  {/if}
</div>
