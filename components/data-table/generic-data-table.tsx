"use client";

import React, { useMemo } from "react";
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
  VisibilityState,
  RowSelectionState,
  SortingState,
  Column,
  Row,
  Table as TanStackTable,
} from "@tanstack/react-table";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ArrowUpDown, ArrowUp, ArrowDown, MoreHorizontal } from "lucide-react";
import {
  ColumnConfig,
  ActionConfig,
  FilterConfig,
  BulkActionConfig,
} from "@/lib/generic-table-types";
import { GenericMultiSelectFilter } from "./generic-filter";
import { SearchInput } from "./search-input";
import { ViewControl } from "./table-controls";
import { Pagination } from "./pagination";
import { Spinner } from "@/components/ui/spinner";

interface GenericDataTableProps<T> {
  data: T[];
  columns: ColumnConfig<T>[];
  actions?: ActionConfig<T>[];
  filters?: FilterConfig<T>[];
  bulkActions?: BulkActionConfig<T>[];
  totalCount: number;
  pageCount: number;
  currentPage: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  sorting: SortingState;
  onSortingChange: (
    sorting: SortingState | ((old: SortingState) => SortingState)
  ) => void;
  columnVisibility: VisibilityState;
  onColumnVisibilityChange: (
    visibility: VisibilityState | ((old: VisibilityState) => VisibilityState)
  ) => void;
  isLoading: boolean;
  rowSelection: RowSelectionState;
  onRowSelectionChange: (
    selection:
      | RowSelectionState
      | ((old: RowSelectionState) => RowSelectionState)
  ) => void;
  getRowId?: (row: T) => string;
  emptyMessage?: string;
  // Search and filter props
  search?: string;
  onSearchChange?: (search: string) => void;
  filterValues?: Record<string, unknown[]>;
  onFilterChange?: (filterId: string, values: unknown[]) => void;
  // Clear filters
  onClearFilters?: () => void;
  // Title and description
  title?: string;
  description?: string;
  // Optional: disable row selection entirely
  enableRowSelection?: boolean;
}

export function GenericDataTable<T>({
  data,
  columns,
  actions = [],
  filters = [],
  bulkActions = [],
  totalCount,
  pageCount,
  currentPage,
  pageSize,
  onPageChange,
  onPageSizeChange,
  sorting,
  onSortingChange,
  columnVisibility,
  onColumnVisibilityChange,
  isLoading,
  rowSelection,
  onRowSelectionChange,
  getRowId,
  emptyMessage = "No results found.",
  search = "",
  onSearchChange,
  filterValues = {},
  onFilterChange,
  onClearFilters,
  title,
  description,
  enableRowSelection = true,
}: GenericDataTableProps<T>) {
  // Default getRowId implementation
  const defaultGetRowId = (row: T): string => {
    // Try common ID fields
    if (typeof row === "object" && row !== null) {
      const obj = row as Record<string, unknown>;
      if ("id" in obj && obj.id != null) {
        return String(obj.id);
      }
    }
    // Fallback: use index (not ideal but safe)
    const index = data.indexOf(row);
    return index >= 0 ? String(index) : String(row);
  };

  const rowIdGetter = getRowId ?? defaultGetRowId;

  const tableColumns: ColumnDef<T>[] = useMemo(
    () => [
      // Selection column (only if enabled)
      ...(enableRowSelection
        ? [
            {
              id: "select",
              header: ({ table }: { table: TanStackTable<T> }) => (
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
              cell: ({ row }: { row: Row<T> }) => (
                <Checkbox
                  checked={row.getIsSelected()}
                  onCheckedChange={(value) => row.toggleSelected(!!value)}
                  aria-label="Select row"
                />
              ),
              enableSorting: false,
              enableHiding: false,
            },
          ]
        : []),

      // Data columns
      ...columns.map((column) => ({
        id: column.id as string,
        accessorKey: column.id,
        header: ({ column: tableColumn }: { column: Column<T, unknown> }) => {
          if (!column.sortable) {
            return (
              <div className="font-semibold text-center">{column.label}</div>
            );
          }

          return (
            <Button
              variant="ghost"
              onClick={() =>
                tableColumn.toggleSorting(tableColumn.getIsSorted() === "asc")
              }
              className="h-auto w-full p-0 font-semibold justify-center text-center"
            >
              {column.label}
              {tableColumn.getIsSorted() === "asc" ? (
                <ArrowUp className="ml-2 h-4 w-4" />
              ) : tableColumn.getIsSorted() === "desc" ? (
                <ArrowDown className="ml-2 h-4 w-4" />
              ) : (
                <ArrowUpDown className="ml-2 h-4 w-4" />
              )}
            </Button>
          );
        },
        cell: ({ row }: { row: Row<T> }) => {
          const value = row.getValue(column.id as string);

          if (column.render) {
            return column.render(value, row.original);
          }

          return (
            <div className={column.className}>{value as React.ReactNode}</div>
          );
        },
        enableHiding: column.hideable !== false,
      })),

      // Actions column
      ...(actions.length > 0
        ? [
            {
              id: "actions",
              enableHiding: false,
              cell: ({ row }: { row: Row<T> }) => {
                const rowData = row.original;

                return (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" className="h-8 w-8 p-0">
                        <span className="sr-only">Open menu</span>
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {actions.map((action, index) => (
                        <React.Fragment key={action.id}>
                          <DropdownMenuItem
                            onClick={() => action.onClick(rowData)}
                            disabled={
                              action.disabled ? action.disabled(rowData) : false
                            }
                            className={
                              action.variant === "destructive"
                                ? "text-red-600"
                                : ""
                            }
                          >
                            {action.icon && (
                              <action.icon className="mr-2 h-4 w-4" />
                            )}
                            {action.label}
                          </DropdownMenuItem>
                          {index < actions.length - 1 &&
                            action.variant === "destructive" && (
                              <DropdownMenuSeparator />
                            )}
                        </React.Fragment>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                );
              },
            },
          ]
        : []),
    ],
    [columns, actions, enableRowSelection]
  );

  const table = useReactTable({
    data,
    columns: tableColumns,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
    manualSorting: true,
    getRowId: rowIdGetter,
    onSortingChange: (updaterOrValue) => {
      const newValue =
        typeof updaterOrValue === "function"
          ? updaterOrValue(sorting)
          : updaterOrValue;
      onSortingChange(newValue);
    },
    onColumnVisibilityChange: (updaterOrValue) => {
      const newValue =
        typeof updaterOrValue === "function"
          ? updaterOrValue(columnVisibility)
          : updaterOrValue;
      onColumnVisibilityChange(newValue);
    },
    onRowSelectionChange: (updaterOrValue) => {
      const newValue =
        typeof updaterOrValue === "function"
          ? updaterOrValue(rowSelection)
          : updaterOrValue;
      onRowSelectionChange(newValue);
    },
    state: {
      sorting,
      columnVisibility,
      rowSelection,
    },
  });

  const selectedRowsCount = Object.keys(rowSelection).length;
  const selectedRows = useMemo(
    () =>
      data.filter((row) => {
        const rowId = rowIdGetter(row);
        return rowSelection[rowId] === true;
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data, rowSelection] // rowIdGetter is stable, no need to include
  );

  return (
    <div className="w-full space-y-4">
      {/* Header */}
      {(title || description) && (
        <div>
          {title && (
            <h2 className="text-2xl font-bold tracking-tight">{title}</h2>
          )}
          {description && (
            <p className="text-muted-foreground">{description}</p>
          )}
        </div>
      )}

      {/* Search and Filters */}
      <div className="flex flex-col space-y-4">
        {/* Search Bar */}
        {onSearchChange && (
          <div className="flex w-full items-center space-x-2">
            <SearchInput
              value={search}
              onSearchChange={onSearchChange}
              placeholder="Search..."
              className="w-full max-w-lg"
            />
          </div>
        )}

        {/* Filters and Controls */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-2">
            {/* Dynamic Filters */}
            {filters.map((filter) => {
              const filterValues_ = filterValues[filter.id as string] || [];
              return (
                <GenericMultiSelectFilter
                  key={filter.id as string}
                  selectedValues={filterValues_}
                  onValuesChange={(values: unknown[]) =>
                    onFilterChange?.(filter.id as string, values)
                  }
                  options={filter.options || []}
                  label={filter.label}
                  icon={filter.icon}
                />
              );
            })}

            {/* Clear All Filters */}
            {onClearFilters &&
              Object.values(filterValues).some(
                (values) => values.length > 0
              ) && (
                <Button variant="ghost" onClick={onClearFilters}>
                  Clear filters
                </Button>
              )}
          </div>

          <div className="flex items-center space-x-2">
            <ViewControl
              columnVisibility={columnVisibility}
              onColumnVisibilityChange={onColumnVisibilityChange}
              columns={columns.map((col) => ({
                id: col.id as string,
                label: col.label,
                hideable: col.hideable,
              }))}
            />
          </div>
        </div>

        {/* Bulk Actions */}
        {selectedRowsCount > 0 && bulkActions.length > 0 && (
          <div className="flex items-center space-x-2 rounded-md border border-dashed p-2">
            <span className="text-sm text-muted-foreground">
              {selectedRowsCount} row(s) selected
            </span>
            {bulkActions.map((action) => (
              <Button
                key={action.id}
                variant={action.variant || "outline"}
                size="sm"
                onClick={() => action.onClick(selectedRows)}
                className="h-8"
              >
                {action.icon && <action.icon className="mr-2 h-4 w-4" />}
                {action.label}
              </Button>
            ))}
          </div>
        )}
      </div>

      {/* Table */}
      <div className="rounded-md border">
        <Table className="border-separate border-spacing-0 [&_th]:border-l [&_th]:border-border/60 [&_th:first-child]:border-l-0 [&_th:last-child]:border-r-0 [&_th]:text-center [&_td]:border-l [&_td]:border-border/40 [&_td:first-child]:border-l-0 [&_td:last-child]:border-r-0 [&_td]:text-center">
          {!isLoading && (
            <TableHeader className="bg-primary/5 text-primary-foreground rounded-md">
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map((header) => {
                    return (
                      <TableHead key={header.id}>
                        {header.isPlaceholder
                          ? null
                          : flexRender(
                              header.column.columnDef.header,
                              header.getContext()
                            )}
                      </TableHead>
                    );
                  })}
                </TableRow>
              ))}
            </TableHeader>
          )}
          <TableBody>
            {isLoading ? (
              // Loading spinner
              <TableRow>
                <TableCell
                  colSpan={tableColumns.length}
                  className="h-96 text-center"
                >
                  <div className="flex flex-col items-center justify-center gap-4 py-12">
                    <Spinner />
                  </div>
                </TableCell>
              </TableRow>
            ) : table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && "selected"}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={tableColumns.length}
                  className="h-24 text-center"
                >
                  {emptyMessage}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {!isLoading && (
        <Pagination
          currentPage={currentPage}
          pageCount={pageCount}
          pageSize={pageSize}
          totalCount={totalCount}
          onPageChange={onPageChange}
          onPageSizeChange={onPageSizeChange}
          selectedRowCount={selectedRowsCount}
          totalRowsOnPage={data.length}
        />
      )}
    </div>
  );
}
