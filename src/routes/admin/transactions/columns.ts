import { type JournalRecord } from "$lib/types";
import DataTableColumnHeader from "$ui/data-table/data-table-column-header.svelte";
import {
  DataTableSelectCell,
  DataTableSelectHeader,
  renderComponent,
  renderSnippet,
  type ColumnDef
} from "$ui/data-table/index.js";
import { formatAccounting, formatDate } from "$utils/formatters";
import { translateMop, translateTransactionType } from "$utils/translators";
import { createRawSnippet } from "svelte";

export const columns: ColumnDef<JournalRecord>[] = [
  {
    id: "select",
    header: ({ table }) => renderComponent(DataTableSelectHeader, { table }),
    cell: ({ row }) =>
      renderComponent(DataTableSelectCell, { row, disabled: !!row.original.wasAudited }),
    enableSorting: false,
    enableHiding: false
  },
  {
    accessorKey: "date",
    header: ({ column }) => renderComponent(DataTableColumnHeader, { column, title: "Date" }),
    cell: ({ row }) => {
      const dateSnippet = createRawSnippet<[{ date: string }]>((p) => ({
        render: () => `<span class="text-sm">${formatDate(p().date)}</span>`
      }));
      return renderSnippet(dateSnippet, { date: row.original.date });
    }
  },
  {
    accessorKey: "creatorName",
    header: "Recorder",
    cell: ({ row }) => {
      const creatorSnippet = createRawSnippet<[{ record: JournalRecord }]>((p) => {
        const r = p().record;
        return {
          render: () => `
            <div class="flex md:block md:whitespace-normal md:max-w-55 md:wrap-break-word">
              <span class="text-sm font-medium">${r.creatorName}</span>
            </div>
          `
        };
      });
      return renderSnippet(creatorSnippet, { record: row.original });
    }
  },
  {
    accessorKey: "name",
    header: "Account",
    cell: ({ row }) => {
      const accountSnippet = createRawSnippet<[{ record: JournalRecord }]>((p) => {
        const r = p().record;
        return {
          render: () => `
            <div class="flex md:block md:whitespace-normal md:max-w-50 md:wrap-break-word">
              <span class="text-sm font-medium">${r.name}</span>
            </div>
          `
        };
      });
      return renderSnippet(accountSnippet, { record: row.original });
    }
  },
  {
    id: "details",
    header: "Details",
    cell: ({ row }) => {
      const detailsSnippet = createRawSnippet<[{ record: JournalRecord }]>((p) => {
        const r = p().record;
        return {
          render: () => `
            <div class="flex flex-col gap-2">
              <div class="flex flex-col">
                <span class="text-sm uppercase">${translateTransactionType(r.type)}</span>
                <span class="text-sm text-muted-foreground">${translateMop(r.mop)}</span>
              </div>
              ${r.notes ? `<span class="text-sm text-muted-foreground truncate max-w-75 block italic">— ${r.notes}</span>` : ""}
            </div>
          `
        };
      });
      return renderSnippet(detailsSnippet, { record: row.original });
    }
  },
  {
    id: "status",
    header: "Status",
    cell: ({ row }) => {
      const statusSnippet = createRawSnippet<[{ record: JournalRecord }]>((p) => {
        const r = p().record;
        return {
          render: () =>
            r.wasAudited
              ? `<span data-slot="badge" class="inline-flex h-5 w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-4xl border border-transparent bg-primary px-2 py-0.5 text-xs font-medium whitespace-nowrap text-primary-foreground">AUDITED</span>`
              : `<span class="text-xs text-muted-foreground">&#8212;</span>`
        };
      });
      return renderSnippet(statusSnippet, { record: row.original });
    }
  },
  {
    accessorKey: "amount",
    header: () => {
      const headerSnippet = createRawSnippet(() => ({
        render: () => `<div class="text-right flex-1">Total</div>`
      }));
      return renderSnippet(headerSnippet, {});
    },
    cell: ({ row }) => {
      const amountSnippet = createRawSnippet<[{ amount: number }]>((p) => ({
        render: () =>
          `<div class="text-right text-sm font-medium">${formatAccounting(p().amount || 0)}</div>`
      }));
      return renderSnippet(amountSnippet, { amount: row.original.amount });
    }
  },
  {
    accessorKey: "runningBalance",
    header: () => {
      const headerSnippet = createRawSnippet(() => ({
        render: () => `<div class="text-right flex-1">Balance</div>`
      }));
      return renderSnippet(headerSnippet, {});
    },
    cell: ({ row }) => {
      const balSnippet = createRawSnippet<[{ amount: number }]>((p) => ({
        render: () =>
          `<div class="text-right text-sm font-medium ${p().amount < 0 ? "text-primary" : ""}">${formatAccounting(p().amount || 0)}</div>`
      }));
      return renderSnippet(balSnippet, { amount: row.original.runningBalance ?? 0 });
    }
  }
];
