import { type ResidentRecord as Resident } from "$lib/types";
import {
  DataTableColumnHeader,
  DataTableSelectCell,
  DataTableSelectHeader,
  renderComponent,
  renderSnippet,
  type ColumnDef
} from "$ui/data-table/index.js";
import { formatAccounting } from "$utils/formatters";
import { createRawSnippet } from "svelte";

export const columns: ColumnDef<Resident>[] = [
  {
    id: "select",
    header: ({ table }) => renderComponent(DataTableSelectHeader, { table }),
    cell: ({ row }) => renderComponent(DataTableSelectCell, { row }),
    enableSorting: false,
    enableHiding: false
  },
  {
    accessorKey: "name",
    header: ({ column }) => renderComponent(DataTableColumnHeader, { column, title: "Resident" }),
    cell: ({ row }) => {
      const nameSnippet = createRawSnippet<[{ name: string }]>((p) => ({
        render: () => `<span class="font-medium">${p().name}</span>`
      }));
      return renderSnippet(nameSnippet, { name: row.original.name });
    }
  },
  {
    accessorKey: "room",
    header: ({ column }) => renderComponent(DataTableColumnHeader, { column, title: "Room" }),
    cell: ({ row }) => {
      const roomSnippet = createRawSnippet<[{ room?: string }]>((p) => ({
        render: () => `<span>${p().room || "—"}</span>`
      }));
      return renderSnippet(roomSnippet, { room: row.original.room });
    }
  },
  {
    accessorKey: "bed",
    header: "Bed",
    cell: ({ row }) => {
      const bedSnippet = createRawSnippet<[{ bed?: string }]>((p) => ({
        render: () => `<span>${p().bed || "—"}</span>`
      }));
      return renderSnippet(bedSnippet, { bed: row.original.bed });
    }
  },
  {
    id: "balances",
    header: () => {
      const headerSnippet = createRawSnippet(() => ({
        render: () => `<div class="text-center w-full font-semibold">Balance</div>`
      }));
      return renderSnippet(headerSnippet, {});
    },
    columns: [
      {
        accessorKey: "waterBal",
        header: ({ column }) =>
          renderComponent(DataTableColumnHeader, { column, title: "Water Fee", class: "ml-auto" }),
        cell: ({ row }) => {
          const amountSnippet = createRawSnippet<[{ amount: number }]>((p) => ({
            render: () =>
              `<div class="text-right text-sm">${formatAccounting(p().amount || 0)}</div>`
          }));
          return renderSnippet(amountSnippet, { amount: row.original.waterBal });
        }
      },
      {
        accessorKey: "assocBal",
        header: ({ column }) =>
          renderComponent(DataTableColumnHeader, {
            column,
            title: "Association Fee",
            class: "ml-auto"
          }),
        cell: ({ row }) => {
          const amountSnippet = createRawSnippet<[{ amount: number }]>((p) => ({
            render: () =>
              `<div class="text-right text-sm">${formatAccounting(p().amount || 0)}</div>`
          }));
          return renderSnippet(amountSnippet, { amount: row.original.assocBal });
        }
      },
      {
        accessorKey: "maintenanceBal",
        header: ({ column }) =>
          renderComponent(DataTableColumnHeader, {
            column,
            title: "Maintenance & Gas Fee",
            class: "ml-auto"
          }),
        cell: ({ row }) => {
          const amountSnippet = createRawSnippet<[{ amount: number }]>((p) => ({
            render: () =>
              `<div class="text-right text-sm">${formatAccounting(p().amount || 0)}</div>`
          }));
          return renderSnippet(amountSnippet, { amount: row.original.maintenanceBal || 0 });
        }
      },
      {
        accessorKey: "bal",
        header: ({ column }) =>
          renderComponent(DataTableColumnHeader, {
            column,
            title: "Outstanding",
            class: "ml-auto"
          }),
        cell: ({ row }) => {
          const balSnippet = createRawSnippet<[{ r: Resident }]>((p) => {
            const res = p().r;
            return {
              render: () =>
                `<div class="text-right text-sm font-medium">${formatAccounting(res.bal || 0)}</div>`
            };
          });
          return renderSnippet(balSnippet, { r: row.original });
        }
      }
    ]
  },
  {
    accessorKey: "isFullyPaid",
    id: "status", // Keep id as status for filtering/hiding if needed
    header: ({ column }) =>
      renderComponent(DataTableColumnHeader, { column, title: "Status", class: "mx-auto" }),
    cell: ({ row }) => {
      return renderComponent(ResidentStatusCell, { resident: row.original });
    }
  }
];

import ResidentStatusCell from "./ResidentStatusCell.svelte";
