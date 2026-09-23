import CompositionCell from "$components/residents/PaymentCompositionCell.svelte";
import type { PaymentRequestRecord } from "$lib/types";
import { PAYMENT_REQUEST_STATUS_COLORS, PaymentRequestStatus } from "$lib/types";
import { Button } from "$ui/button";
import DataTableColumnHeader from "$ui/data-table/data-table-column-header.svelte";
import { renderComponent, renderSnippet, type ColumnDef } from "$ui/data-table/index.js";
import { formatAccounting, formatDate } from "$utils/formatters";
import { translateMop } from "$utils/translators";
import { Trash2 } from "@lucide/svelte";
import { createRawSnippet } from "svelte";

export const columns: ColumnDef<PaymentRequestRecord>[] = [
  {
    accessorKey: "date",
    header: ({ column }) => renderComponent(DataTableColumnHeader, { column, title: "Date" }),
    cell: ({ row }) => formatDate(row.getValue("date"))
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
            ${p().notes ? `<span class="text-sm text-muted-foreground italic truncate max-w-50 block">— ${p().notes}</span>` : ""}
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
  },
  {
    id: "actions",
    cell: ({ row, table }) => {
      const r = row.original;
      if (r.status !== PaymentRequestStatus.PENDING) return null;

      // @ts-ignore
      const onCancel = table.options.meta?.onCancel;

      return renderComponent(Button, {
        variant: "ghost",
        size: "icon",
        class: "h-8 w-8 text-muted-foreground hover:text-destructive",
        onclick: (e: MouseEvent) => {
          e.stopPropagation();
          onCancel?.(r.id);
        },
        icon: Trash2
      });
    }
  }
];
