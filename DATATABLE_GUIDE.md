# Dynamic Datatable Component Guide

This guide explains how to use the dynamic datatable component that has been implemented in your project.

## Overview

The datatable component is a flexible, feature-rich table component built on top of TanStack React Table (formerly React Table). It supports:

- **Sorting**: Click column headers to sort ascending/descending
- **Filtering**: Multiple filter types (text, number, range, date, select, multiSelect)
- **Pagination**: Navigate through pages with customizable page sizes
- **Column Visibility**: Toggle column visibility
- **Row Selection**: Select individual or multiple rows
- **Responsive Design**: Works seamlessly on all screen sizes

## File Structure

```
components/datatable/
├── data-table.tsx                    # Main table component
├── data-table-pagination.tsx         # Pagination controls
├── data-table-toolbar.tsx            # Filtering and toolbar
├── data-table-column-header.tsx      # Column header with sort/hide
├── data-table-view-options.tsx       # Column visibility toggle
├── data-table-faceted-filter.tsx     # Select/multiSelect filter
├── data-table-date-filter.tsx        # Date/dateRange filter
├── data-table-slider-filter.tsx      # Range filter with slider
├── data-table-range-filter.tsx       # Simple range filter
├── data-table-advanced-toolbar.tsx   # Advanced toolbar variant
├── data-table-skeleton.tsx           # Loading skeleton
└── index.ts                          # Barrel export

lib/
└── data-table.ts                     # Utility functions

types/
└── datatable.ts                      # TypeScript type definitions
```

## Basic Usage

### 1. Import Components

```typescript
import {
  DataTable,
  DataTableToolbar,
  DataTableColumnHeader,
} from "@/components/datatable";
```

### 2. Define Your Data Type

```typescript
interface Task {
  id: string;
  title: string;
  status: "todo" | "in-progress" | "done";
  priority: "low" | "medium" | "high";
  dueDate: Date;
}
```

### 3. Create Columns

```typescript
import { createColumnHelper } from "@tanstack/react-table";

const columnHelper = createColumnHelper<Task>();

const columns = [
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
    cell: (info) => info.getValue(),
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
];
```

### 4. Set Up Table State

```typescript
import {
  useReactTable,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
} from "@tanstack/react-table";

export default function MyTable() {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [rowSelection, setRowSelection] = useState({});

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
    <div className="space-y-4">
      <DataTableToolbar table={table} />
      <DataTable table={table} />
    </div>
  );
}
```

## Filter Variants

### Text Filter
```typescript
meta: {
  label: "Title",
  variant: "text",
  placeholder: "Search title...",
}
```

### Number Filter
```typescript
meta: {
  label: "Count",
  variant: "number",
  unit: "items",
}
```

### Range Filter (Slider)
```typescript
meta: {
  label: "Price",
  variant: "range",
  range: [0, 1000],
  unit: "$",
}
```

### Date Filter
```typescript
meta: {
  label: "Created",
  variant: "date",
}
```

### Date Range Filter
```typescript
meta: {
  label: "Date Range",
  variant: "dateRange",
}
```

### Select Filter
```typescript
meta: {
  label: "Status",
  variant: "select",
  options: [
    { label: "Active", value: "active" },
    { label: "Inactive", value: "inactive" },
  ],
}
```

### MultiSelect Filter
```typescript
meta: {
  label: "Tags",
  variant: "multiSelect",
  options: [
    { label: "Important", value: "important" },
    { label: "Urgent", value: "urgent" },
    { label: "Review", value: "review" },
  ],
}
```

## Advanced Features

### Row Selection

Add a select column:
```typescript
columnHelper.display({
  id: "select",
  header: ({ table }) => (
    <Checkbox
      checked={table.getIsAllPageRowsSelected()}
      onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
    />
  ),
  cell: ({ row }) => (
    <Checkbox
      checked={row.getIsSelected()}
      onCheckedChange={(value) => row.toggleSelected(!!value)}
    />
  ),
  enableSorting: false,
  enableHiding: false,
})
```

### Custom Cell Rendering

```typescript
columnHelper.accessor("status", {
  header: "Status",
  cell: (info) => {
    const status = info.getValue();
    return (
      <Badge variant={status === "done" ? "default" : "secondary"}>
        {status}
      </Badge>
    );
  },
})
```

### Loading State

Use `DataTableSkeleton` while loading:
```typescript
{isLoading ? (
  <DataTableSkeleton
    columnCount={columns.length}
    rowCount={10}
    filterCount={2}
  />
) : (
  <DataTable table={table} />
)}
```

## Demo Page

A complete working example is available at `/datatable-demo`:

```
http://localhost:3000/datatable-demo
```

This page demonstrates:
- All filter types
- Sorting
- Pagination
- Row selection
- Column visibility toggle

## Component Props

### DataTable
- `table`: TanStack React Table instance
- `actionBar?`: Optional action bar for selected rows
- `className?`: Additional CSS classes
- `children?`: Additional content above the table

### DataTableToolbar
- `table`: TanStack React Table instance
- `children?`: Additional toolbar items
- `className?`: Additional CSS classes

### DataTablePagination
- `table`: TanStack React Table instance
- `pageSizeOptions?`: Array of page size options (default: [10, 20, 30, 40, 50])
- `className?`: Additional CSS classes

### DataTableColumnHeader
- `column`: TanStack React Table column
- `label`: Column header text
- `className?`: Additional CSS classes

## Type Definitions

The datatable types are defined in `types/datatable.ts` and extend TanStack React Table's ColumnMeta interface with:

```typescript
interface ColumnMeta<TData extends RowData, TValue> {
  label?: string;
  placeholder?: string;
  variant?: "text" | "number" | "range" | "date" | "dateRange" | "select" | "multiSelect";
  options?: Option[];
  range?: [number, number];
  unit?: string;
  icon?: React.FC<React.SVGProps<SVGSVGElement>>;
}
```

## Styling

The datatable uses Tailwind CSS and shadcn/ui components. All styling is responsive and follows your project's design system.

## Performance Considerations

- The datatable uses React Query's pagination pattern for large datasets
- Filtering and sorting are performed client-side by default
- For large datasets (>10k rows), consider implementing server-side filtering/sorting
- Use `getPaginationRowModel` to limit rendered rows

## Browser Support

- Chrome/Edge (latest)
- Firefox (latest)
- Safari (latest)
- Mobile browsers

## Troubleshooting

### Filters not appearing
- Ensure `variant` is set in column `meta`
- Check that `getCanFilter()` returns true for the column

### Sorting not working
- Add `DataTableColumnHeader` component to column header
- Ensure column is sortable (no `enableSorting: false`)

### Pagination not showing
- Ensure `getPaginationRowModel` is included in table config
- Check that data length exceeds page size

## Next Steps

1. Visit `/datatable-demo` to see the component in action
2. Copy the demo code to your own pages
3. Customize columns and filters for your data
4. Integrate with your API/data fetching logic
