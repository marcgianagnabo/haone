import { USER_TAG_COLORS, UserTag, type UserRecord as User } from "$lib/types";
import DataTableColumnHeader from "$ui/data-table/data-table-column-header.svelte";
import { renderComponent, renderSnippet, type ColumnDef } from "$ui/data-table/index.js";
import { translateCollege, translateProgram } from "$utils/translators";
import { normalizeStudentNo } from "$utils/student-no";
import { createRawSnippet } from "svelte";

export const columns: ColumnDef<User>[] = [
  {
    accessorKey: "displayName",
    header: ({ column }) => renderComponent(DataTableColumnHeader, { column, title: "User" }),
    cell: ({ row }) => {
      const snippet = createRawSnippet<[{ name: string; email: string }]>((p) => ({
        render: () => `
          <div class="flex flex-col">
            <span class="text-sm text-foreground font-medium">${p().name}</span>
            <span class="text-sm text-muted-foreground">${p().email}</span>
          </div>
        `
      }));
      return renderSnippet(snippet, {
        name: row.original.displayName,
        email: row.original.email
      });
    }
  },
  {
    accessorKey: "studentNo",
    header: ({ column }) =>
      renderComponent(DataTableColumnHeader, { column, title: "Student Number" }),
    cell: ({ row }) => {
      const snippet = createRawSnippet<[{ val: string }]>((p) => ({
        render: () =>
          `<span class="text-sm text-foreground font-medium">${p().val}</span>`
      }));
      return renderSnippet(snippet, { val: normalizeStudentNo(row.original.studentNo) });
    }
  },
  {
    accessorKey: "college",
    header: ({ column }) => renderComponent(DataTableColumnHeader, { column, title: "College" }),
    cell: ({ row }) => {
      const colleges = translateCollege(row.original.college);
      const latest = colleges[colleges.length - 1] || "—";
      const snippet = createRawSnippet<[{ val: string }]>((p) => ({
        render: () =>
          `<span class="text-sm text-foreground leading-tight whitespace-normal wrap-break-word">${p().val}</span>`
      }));
      return renderSnippet(snippet, { val: latest });
    }
  },
  {
    accessorKey: "program",
    header: ({ column }) => renderComponent(DataTableColumnHeader, { column, title: "Program" }),
    cell: ({ row }) => {
      const programs = translateProgram(row.original.program);
      const latest = programs[programs.length - 1] || "—";
      const snippet = createRawSnippet<[{ val: string }]>((p) => ({
        render: () =>
          `<span class="text-sm text-foreground leading-tight whitespace-normal wrap-break-word">${p().val}</span>`
      }));
      return renderSnippet(snippet, { val: latest });
    }
  },

  {
    accessorKey: "tags",
    header: ({ column }) => renderComponent(DataTableColumnHeader, { column, title: "Tags" }),
    cell: ({ row }) => {
      const tagsStr = row.original.tags || UserTag.STUDENT;
      const tags = tagsStr
        .split(":")
        .map((t) => t.trim())
        .filter(Boolean);
      const snippet = createRawSnippet<[{ tags: string[] }]>((p) => ({
        render: () => {
          return `<div class="flex flex-wrap gap-1">
            ${p()
              .tags.map((t) => {
                const colorClass = USER_TAG_COLORS[t] || USER_TAG_COLORS.DEFAULT;
                return `<span class="inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold tracking-tight ${colorClass}">${t}</span>`;
              })
              .join("")}
          </div>`;
        }
      }));
      return renderSnippet(snippet, { tags });
    }
  }
];
