import CompositionCell from "$components/residents/PaymentCompositionCell.svelte";
import type { PaymentRequestRecord } from "$lib/types";
import { PAYMENT_REQUEST_STATUS_COLORS } from "$lib/types";
import DataTableColumnHeader from "$ui/data-table/data-table-column-header.svelte";
import {
  DataTableSelectCell,
  DataTableSelectHeader,
  renderComponent,
  renderSnippet,
  type ColumnDef
} from "$ui/data-table/index.js";
import { formatAccounting, formatDate } from "$utils/formatters";
import { translateMop } from "$utils/translators";
import { createRawSnippet } from "svelte";

export const columns: ColumnDef<PaymentRequestRecord>[] = [
  {
    id: "select",
    header: ({ table }) => renderComponent(DataTableSelectHeader, { table }),
    cell: ({ row }) => renderComponent(DataTableSelectCell, { row }),
    enableSorting: false,
    enableHiding: false
  },
  {
    accessorKey: "date",
    header: ({ column }) => renderComponent(DataTableColumnHeader, { column, title: "Date" }),
    cell: ({ row }) => formatDate(row.getValue("date"))
  },
  {
    accessorKey: "residentId",
    header: ({ column }) => renderComponent(DataTableColumnHeader, { column, title: "Resident" }),
    cell: ({ row, table }) => {
      const resId = row.original.residentId;
      // @ts-ignore
      const residents = table.options.meta?.residents || [];
      const resident = residents.find((r: any) => r.residentId === resId);
      const name = resident ? resident.name : resId;

      const residentSnippet = createRawSnippet<[{ name: string }]>((p) => ({
        render: () => `<span class="text-sm font-medium">${p().name}</span>`
      }));
      return renderSnippet(residentSnippet, { name });
    }
  },
  {
    id: "composition",
    header: "Composition",
    cell: ({ row }) => {
      const r = row.original;
      return renderComponent(CompositionCell, {
        variant: "composition",
        record: {
          ...r,
          water: r.waterFee,
          assoc: r.assocFee,
          maintenance: r.maintenanceFee || 0,
          misc: r.misc
        } as any
      });
    }
  },
  {
    id: "details",
    header: "Payment Details",
    cell: ({ row }) => {
      const r = row.original;
      const snippet = createRawSnippet<[{ mop: string; notes: string }]>((p) => ({
        render: () => `
          <div class="flex flex-col">
            <span class="text-sm font-medium uppercase">${translateMop(p().mop)}</span>
            ${p().notes ? `<span class="text-sm text-muted-foreground italic truncate max-w-75 block">— ${p().notes}</span>` : ""}
          </div>
        `
      }));
      return renderSnippet(snippet, { mop: r.mop, notes: r.notes });
    }
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => {
      const status = row.getValue("status") as string;
      const statusSnippet = createRawSnippet<[{ status: string }]>((p) => ({
        render: () => {
          const s = p().status;
          const cls =
            PAYMENT_REQUEST_STATUS_COLORS[s as keyof typeof PAYMENT_REQUEST_STATUS_COLORS] ||
            PAYMENT_REQUEST_STATUS_COLORS.DEFAULT;
          return `<span class="inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold tracking-tight uppercase ${cls}">${s}</span>`;
        }
      }));
      return renderSnippet(statusSnippet, { status });
    }
  },
  {
    id: "total",
    header: ({ column }) =>
      renderComponent(DataTableColumnHeader, { column, title: "Total", class: "ml-auto" }),
    cell: ({ row }) => {
      const r = row.original;
      const amountSnippet = createRawSnippet<[{ amount: number }]>((p) => ({
        render: () => `<div class="text-right font-bold">${formatAccounting(p().amount)}</div>`
      }));
      return renderSnippet(amountSnippet, {
        amount: r.waterFee + r.assocFee + r.misc + (r.maintenanceFee || 0)
      });
    }
  }
];
