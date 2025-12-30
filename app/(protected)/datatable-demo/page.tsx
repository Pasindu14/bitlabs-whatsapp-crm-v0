"use client";

import * as React from "react";
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnFiltersState,
  type SortingState,
  type VisibilityState,
} from "@tanstack/react-table";

import {
  DataTable,
  DataTableToolbar,
  DataTableColumnHeader,
  DataTableSkeleton,
} from "@/components/datatable";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";

interface Task {
  id: string;
  title: string;
  status: "todo" | "in-progress" | "done";
  priority: "low" | "medium" | "high";
  dueDate: Date;
}

const tasks: Task[] = [
  {
    id: "1",
    title: "Implement datatable component",
    status: "done",
    priority: "high",
    dueDate: new Date("2024-01-15"),
  },
  {
    id: "2",
    title: "Add filtering functionality",
    status: "in-progress",
    priority: "high",
    dueDate: new Date("2024-01-20"),
  },
  {
    id: "3",
    title: "Create documentation",
    status: "todo",
    priority: "medium",
    dueDate: new Date("2024-02-01"),
  },
  {
    id: "4",
    title: "Write unit tests",
    status: "todo",
    priority: "medium",
    dueDate: new Date("2024-02-05"),
  },
  {
    id: "5",
    title: "Performance optimization",
    status: "todo",
    priority: "low",
    dueDate: new Date("2024-02-15"),
  },
  {
    id: "6",
    title: "Fix responsive design",
    status: "in-progress",
    priority: "high",
    dueDate: new Date("2024-01-25"),
  },
  {
    id: "7",
    title: "Add dark mode support",
    status: "todo",
    priority: "low",
    dueDate: new Date("2024-03-01"),
  },
  {
    id: "8",
    title: "Accessibility improvements",
    status: "todo",
    priority: "medium",
    dueDate: new Date("2024-02-10"),
  },
];

const columnHelper = createColumnHelper<Task>();

export default function DatatableDemoPage() {
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>(
    [],
  );
  const [columnVisibility, setColumnVisibility] =
    React.useState<VisibilityState>({});
  const [rowSelection, setRowSelection] = React.useState({});

  const columns = [
    columnHelper.display({
      id: "select",
      header: ({ table }) => (
        <Checkbox
          checked={
            table.getIsAllPageRowsSelected() ||
            (table.getIsSomePageRowsSelected() && "indeterminate")
          }
          onCheckedChange={(value) =>
            table.toggleAllPageRowsSelected(!!value)
          }
          aria-label="Select all"
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(value) => row.toggleSelected(!!value)}
          aria-label="Select row"
        />
      ),
      enableSorting: false,
      enableHiding: false,
    }),
    columnHelper.accessor("title", {
      header: ({ column }) => (
        <DataTableColumnHeader column={column} label="Title" />
      ),
      cell: (info) => info.getValue(),
      meta: {
        label: "Title",
        variant: "text",
        placeholder: "Search title...",
      },
    }),
    columnHelper.accessor("status", {
      header: ({ column }) => (
        <DataTableColumnHeader column={column} label="Status" />
      ),
      cell: (info) => {
        const status = info.getValue();
        const statusConfig = {
          todo: { label: "To Do", color: "bg-gray-100 text-gray-800" },
          "in-progress": {
            label: "In Progress",
            color: "bg-blue-100 text-blue-800",
          },
          done: { label: "Done", color: "bg-green-100 text-green-800" },
        };
        const config = statusConfig[status];
        return (
          <span className={`px-2 py-1 rounded text-sm font-medium ${config.color}`}>
            {config.label}
          </span>
        );
      },
      meta: {
        label: "Status",
        variant: "select",
        options: [
          { label: "To Do", value: "todo" },
          { label: "In Progress", value: "in-progress" },
          { label: "Done", value: "done" },
        ],
      },
    }),
    columnHelper.accessor("priority", {
      header: ({ column }) => (
        <DataTableColumnHeader column={column} label="Priority" />
      ),
      cell: (info) => {
        const priority = info.getValue();
        const priorityConfig = {
          low: { label: "Low", color: "bg-gray-100 text-gray-800" },
          medium: { label: "Medium", color: "bg-yellow-100 text-yellow-800" },
          high: { label: "High", color: "bg-red-100 text-red-800" },
        };
        const config = priorityConfig[priority];
        return (
          <span className={`px-2 py-1 rounded text-sm font-medium ${config.color}`}>
            {config.label}
          </span>
        );
      },
      meta: {
        label: "Priority",
        variant: "multiSelect",
        options: [
          { label: "Low", value: "low" },
          { label: "Medium", value: "medium" },
          { label: "High", value: "high" },
        ],
      },
    }),
    columnHelper.accessor("dueDate", {
      header: ({ column }) => (
        <DataTableColumnHeader column={column} label="Due Date" />
      ),
      cell: (info) => {
        const date = info.getValue();
        return date.toLocaleDateString("en-US", {
          year: "numeric",
          month: "short",
          day: "numeric",
        });
      },
      meta: {
        label: "Due Date",
        variant: "date",
      },
    }),
  ];

  const table = useReactTable({
    data: tasks,
    columns,
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      rowSelection,
    },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });

  return (
    <div className="space-y-4 p-4">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Datatable Demo</h1>
        <p className="text-muted-foreground mt-2">
          This is a demonstration of the dynamic datatable component. You can
          sort, filter, and paginate the data.
        </p>
      </div>

      <DataTableToolbar table={table} />

      <DataTable table={table} />
    </div>
  );
}
