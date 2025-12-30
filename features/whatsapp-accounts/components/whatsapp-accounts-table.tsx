"use client";

"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, Plus, RefreshCw } from "lucide-react";
import { format } from "date-fns";
import * as React from "react";
import type {
  ColumnFiltersState,
  RowSelectionState,
  SortingState,
} from "@tanstack/react-table";
import {
  createColumnHelper,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";

import { DataTable } from "@/components/datatable/data-table";
import { DataTableToolbar } from "@/components/datatable/data-table-toolbar";
import { DataTableColumnHeader } from "@/components/datatable/data-table-column-header";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { WhatsappAccountForm } from "./whatsapp-account-form";
import {
  useWhatsappAccounts,
  useCreateWhatsappAccount,
  useUpdateWhatsappAccount,
  useSetDefaultWhatsappAccount,
  useToggleWhatsappAccount,
  sortingStateToParams,
} from "../hooks/use-whatsapp-accounts";
import type {
  WhatsappAccountListInput,
  WhatsappAccountResponse,
} from "../schemas/whatsapp-account.schema";

const DEFAULT_PAGE_SIZE = 20;
const columnHelper = createColumnHelper<WhatsappAccountResponse>();

export function WhatsappAccountsTable() {
  const [search, setSearch] = React.useState("");
  const [sorting, setSorting] = React.useState<SortingState>([
    { id: "createdAt", desc: true },
  ]);
  const [columnVisibility, setColumnVisibility] = React.useState({});
  const [rowSelection, setRowSelection] = React.useState<RowSelectionState>({});
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([
    { id: "isActive", value: ["true"] },
  ]);
  const [pageIndex, setPageIndex] = React.useState(0);
  const [pageSize, setPageSize] = React.useState(DEFAULT_PAGE_SIZE);
  const [formOpen, setFormOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<WhatsappAccountResponse | null>(null);

  const statusFilterValue = React.useMemo<"true" | "false" | undefined>(() => {
    const statusFilter = columnFilters.find((filter) => filter.id === "isActive");
    const value = Array.isArray(statusFilter?.value) ? statusFilter.value[0] : undefined;
    return value === "true" || value === "false" ? value : undefined;
  }, [columnFilters]);

  const queryParams = React.useMemo<WhatsappAccountListInput>(() => {
    const sortParams = sortingStateToParams(sorting);
    return {
      cursor: undefined,
      limit: pageSize,
      search: search || undefined,
      isActive:
        statusFilterValue === "true"
          ? true
          : statusFilterValue === "false"
            ? false
            : undefined,
      sortField: sortParams.sortField ?? "createdAt",
      sortOrder: sortParams.sortOrder ?? "desc",
    };
  }, [search, statusFilterValue, sorting, pageSize]);

  const accountsQuery = useWhatsappAccounts(queryParams);
  const pages = accountsQuery.data?.pages ?? [];
  const hasMore = pages.length > 0 ? pages[pages.length - 1]?.hasMore ?? false : false;
  const currentPageData = pages[pageIndex]?.items ?? [];
  const totalCount = pages.reduce((acc, page) => acc + page.items.length, 0);
  const pageCount = pages.length + (hasMore ? 1 : 0) || 1;

  const createMutation = useCreateWhatsappAccount();
  const updateMutation = useUpdateWhatsappAccount();
  const setDefaultMutation = useSetDefaultWhatsappAccount();
  const deactivateMutation = useToggleWhatsappAccount(true);
  const activateMutation = useToggleWhatsappAccount(false);

  const handleCreate = async (values: any) => {
    await createMutation.mutateAsync(values);
    setFormOpen(false);
    setPageIndex(0);
    accountsQuery.refetch();
  };

  const handleUpdate = async (values: any) => {
    if (!editing) return;
    await updateMutation.mutateAsync({ ...values, id: editing.id });
    setEditing(null);
    setFormOpen(false);
    accountsQuery.refetch();
  };

  const isMutating =
    createMutation.isPending ||
    updateMutation.isPending ||
    setDefaultMutation.isPending ||
    deactivateMutation.isPending ||
    activateMutation.isPending;

  const columns = React.useMemo(
    () => [
      columnHelper.accessor("name", {
        header: ({ column }) => (
          <DataTableColumnHeader column={column} label="Name" />
        ),
        cell: (info) => (
          <div className="flex flex-col">
            <span className="font-medium">{info.getValue()}</span>
            <span className="text-xs text-muted-foreground">#{info.row.original.id}</span>
          </div>
        ),
        meta: {
          label: "Name",
          variant: "text",
          placeholder: "Filter by name",
        },
      }),
      columnHelper.accessor("phoneNumberId", {
        header: ({ column }) => (
          <DataTableColumnHeader column={column} label="Phone Number ID" />
        ),
        cell: (info) => (
          <div className="truncate">{info.getValue()}</div>
        ),
      }),
      columnHelper.accessor("businessAccountId", {
        header: ({ column }) => (
          <DataTableColumnHeader column={column} label="Business Account ID" />
        ),
        cell: (info) => (
          <div className="truncate">{info.getValue()}</div>
        ),
      }),
      columnHelper.accessor("isActive", {
        header: ({ column }) => (
          <DataTableColumnHeader column={column} label="Status" />
        ),
        cell: (info) => {
          const row = info.row.original;
          return (
            <div className="flex gap-2">
              <Badge variant={row.isActive ? "default" : "secondary"}>
                {row.isActive ? "Active" : "Inactive"}
              </Badge>
              {row.isDefault && <Badge variant="outline">Default</Badge>}
            </div>
          );
        },
        filterFn: (row, columnId, filterValue) => {
          if (!Array.isArray(filterValue) || filterValue.length === 0) return true;
          const value = row.getValue(columnId);
          const target = filterValue[0];
          if (target === "true") return value === true;
          if (target === "false") return value === false;
          return true;
        },
        meta: {
          label: "Status",
          variant: "select",
          options: [
            { label: "Active", value: "true" },
            { label: "Inactive", value: "false" },
          ],
        },
      }),
      columnHelper.accessor("updatedAt", {
        header: ({ column }) => (
          <DataTableColumnHeader column={column} label="Updated" />
        ),
        cell: (info) => {
          const value = info.getValue();
          return value
            ? format(new Date(value), "yyyy-MM-dd HH:mm")
            : "-";
        },
        meta: {
          label: "Updated",
          variant: "date",
        },
      }),
      columnHelper.accessor("createdAt", {
        header: ({ column }) => (
          <DataTableColumnHeader column={column} label="Created" />
        ),
        cell: (info) => format(new Date(info.getValue()), "yyyy-MM-dd HH:mm"),
        meta: {
          label: "Created",
          variant: "date",
        },
      }),
      columnHelper.display({
        id: "actions",
        header: "Actions",
        cell: ({ row }) => (
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setEditing({
                  ...row.original,
                  webhookUrl: row.original.webhookUrl ?? null,
                });
                setFormOpen(true);
              }}
            >
              Edit
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setDefaultMutation.mutate(row.original.id)}
              disabled={row.original.isDefault}
            >
              Default
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() =>
                row.original.isActive
                  ? deactivateMutation.mutate(row.original.id)
                  : activateMutation.mutate(row.original.id)
              }
            >
              {row.original.isActive ? "Deactivate" : "Activate"}
            </Button>
          </div>
        ),
        enableSorting: false,
        enableHiding: false,
      }),
    ],
    [
      setDefaultMutation,
      deactivateMutation,
      activateMutation,
    ],
  );

  const table = useReactTable({
    data: currentPageData,
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
    manualPagination: true,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => accountsQuery.refetch()}
          disabled={accountsQuery.isFetching}
          aria-label="Refresh"
        >
          <RefreshCw
            className={`h-4 w-4 ${
              accountsQuery.isFetching ? "animate-spin" : ""
            }`}
          />
        </Button>
        <Dialog
          open={formOpen}
          onOpenChange={(open) => {
            setFormOpen(open);
            if (!open) setEditing(null);
          }}
        >
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="mr-2 h-4 w-4" />
              New Account
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>
                {editing ? "Edit account" : "Create account"}
              </DialogTitle>
            </DialogHeader>
            <WhatsappAccountForm
              isEdit={!!editing}
              defaultValues={
                editing
                  ? {
                      ...editing,
                      webhookUrl: editing.webhookUrl ?? undefined,
                    }
                  : undefined
              }
              loading={isMutating}
              onCancel={() => {
                setFormOpen(false);
                setEditing(null);
              }}
              onSubmit={async (values) => {
                if (editing) {
                  await handleUpdate(values);
                } else {
                  await handleCreate(values);
                }
              }}
            />
          </DialogContent>
        </Dialog>
      </div>

      <DataTableToolbar table={table} />
      <DataTable table={table} showPagination={false} />

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          Displaying {currentPageData.length} of {totalCount} accounts
        </p>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            disabled={pageIndex === 0}
            onClick={() => setPageIndex((prev) => Math.max(prev - 1, 0))}
          >
            Previous
          </Button>
          <Button
            variant="outline"
            disabled={!hasMore && pageIndex >= pageCount - 1}
            onClick={async () => {
              const nextIndex = pageIndex + 1;
              if (nextIndex > pages.length - 1 && hasMore) {
                await accountsQuery.fetchNextPage();
              }
              setPageIndex(nextIndex);
            }}
          >
            Next
          </Button>
          <Select
            value={`${pageSize}`}
            onValueChange={(value) => {
              const size = Number(value);
              setPageSize(size);
              setPageIndex(0);
            }}
          >
            <SelectTrigger className="h-8 w-20">
              <SelectValue>{pageSize}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {[10, 20, 30, 40, 50].map((size) => (
                <SelectItem key={size} value={`${size}`}>
                  {size}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}
