"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { RefreshCw, Plus, ShieldCheck, ShieldOff } from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { UserForm } from "./user-form";
import { ResetPasswordDialog } from "./reset-password-dialog";
import {
  useUsers,
  useCreateUser,
  useUpdateUser,
  useToggleUserStatus,
  useResetUserPassword,
  sortingStateToParams,
} from "../hooks/use-users";
import type {
  UserListInput,
  UserResponse,
} from "../schemas/user.schema";
import { USER_ROLES } from "../schemas/user.schema";
import type { UserCreateInput, UserUpdateInput } from "../schemas/user.schema";
type UserFormValues = Omit<UserCreateInput, "temporaryPassword"> & {
  temporaryPassword?: string;
  id?: number;
};

const DEFAULT_PAGE_SIZE = 20;
const columnHelper = createColumnHelper<UserResponse>();

export function UsersTable() {
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
  const [editing, setEditing] = React.useState<UserResponse | null>(null);
  const [resetUserId, setResetUserId] = React.useState<number | null>(null);
  const [resetUserName, setResetUserName] = React.useState<string | undefined>(undefined);

  const statusFilterValue = React.useMemo<"true" | "false" | undefined>(() => {
    const statusFilter = columnFilters.find((filter) => filter.id === "isActive");
    const value = Array.isArray(statusFilter?.value) ? statusFilter.value[0] : undefined;
    return value === "true" || value === "false" ? value : undefined;
  }, [columnFilters]);

  const queryParams = React.useMemo<UserListInput>(() => {
    const sortParams = sortingStateToParams(sorting);
    return {
      cursor: undefined,
      limit: pageSize,
      isActive:
        statusFilterValue === "true"
          ? true
          : statusFilterValue === "false"
            ? false
            : undefined,
      sortField: sortParams.sortField ?? "createdAt",
      sortOrder: sortParams.sortOrder ?? "desc",
    };
  }, [statusFilterValue, sorting, pageSize]);

  const usersQuery = useUsers(queryParams);
  const createMutation = useCreateUser();
  const updateMutation = useUpdateUser();
  const activateMutation = useToggleUserStatus(true);
  const deactivateMutation = useToggleUserStatus(false);
  const resetPasswordMutation = useResetUserPassword();

  const isMutating =
    createMutation.isPending ||
    updateMutation.isPending ||
    activateMutation.isPending ||
    deactivateMutation.isPending ||
    resetPasswordMutation.isPending;

  const handleCreate = async (values: UserFormValues) => {
    if (!values.temporaryPassword) {
      throw new Error("Temporary password is required");
    }
    await createMutation.mutateAsync(values as UserCreateInput);
    setFormOpen(false);
    setPageIndex(0);
    usersQuery.refetch();
  };

  const handleUpdate = async (values: UserFormValues & { id: number }) => {
    if (!editing) return;
    const payload = { ...values, id: editing.id };
    delete (payload as Partial<UserFormValues> & { id: number }).temporaryPassword;
    await updateMutation.mutateAsync(payload as UserUpdateInput & { id: number });
    setEditing(null);
    setFormOpen(false);
    usersQuery.refetch();
  };

  const pages = usersQuery.data?.pages ?? [];
  const hasMore = pages.length > 0 ? pages[pages.length - 1]?.hasMore ?? false : false;
  const currentPageData = pages[pageIndex]?.items ?? [];
  const totalCount = pages.reduce((acc, page) => acc + page.items.length, 0);
  const pageCount = pages.length + (hasMore ? 1 : 0) || 1;
  const isLoading = usersQuery.isLoading || usersQuery.isFetching || isMutating;

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
      columnHelper.accessor("email", {
        header: ({ column }) => (
          <DataTableColumnHeader column={column} label="Email" />
        ),
        cell: (info) => <div className="truncate">{info.getValue()}</div>,
      }),
      columnHelper.accessor("role", {
        header: ({ column }) => (
          <DataTableColumnHeader column={column} label="Role" />
        ),
        cell: (info) => (
          <Badge variant="outline" className="capitalize">
            {info.getValue()}
          </Badge>
        ),
        meta: {
          label: "Role",
          variant: "select",
          options: USER_ROLES.map((role: UserResponse["role"]) => ({ label: role, value: role })),
        },
      }),
      columnHelper.accessor("isActive", {
        header: ({ column }) => (
          <DataTableColumnHeader column={column} label="Status" />
        ),
        cell: (info) => (
          <Badge variant={info.getValue() ? "default" : "secondary"}>
            {info.getValue() ? "Active" : "Inactive"}
          </Badge>
        ),
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
      columnHelper.accessor("startDateTime", {
        header: ({ column }) => (
          <DataTableColumnHeader column={column} label="Start" />
        ),
        cell: (info) =>
          info.getValue()
            ? format(info.getValue(), "yyyy-MM-dd HH:mm")
            : "-",
        meta: {
          label: "Start",
          variant: "date",
        },
      }),
      columnHelper.accessor("updatedAt", {
        header: ({ column }) => (
          <DataTableColumnHeader column={column} label="Updated" />
        ),
        cell: (info) => {
          const value = info.getValue();
          return value ? format(value, "yyyy-MM-dd HH:mm") : "-";
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
        cell: (info) => format(info.getValue(), "yyyy-MM-dd HH:mm"),
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
                setEditing(row.original);
                setFormOpen(true);
              }}
            >
              Edit
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setResetUserId(row.original.id);
                setResetUserName(row.original.name);
              }}
            >
              Reset password
            </Button>
          </div>
        ),
        enableSorting: false,
        enableHiding: false,
      }),
    ],
    []
  );

  // eslint-disable-next-line react-hooks/incompatible-library
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
          onClick={() => usersQuery.refetch()}
          disabled={usersQuery.isFetching}
          aria-label="Refresh"
        >
          <RefreshCw
            className={`h-4 w-4 ${
              usersQuery.isFetching ? "animate-spin" : ""
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
              Add User
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>
                {editing ? "Edit user" : "Add user"}
              </DialogTitle>
            </DialogHeader>
            <UserForm
              isEdit={!!editing}
              defaultValues={editing ?? undefined}
              loading={isMutating}
              onCancel={() => {
                setFormOpen(false);
                setEditing(null);
              }}
              onSubmit={async (values) => {
                if (editing) {
                  await handleUpdate({ ...values, id: editing.id });
                } else {
                  await handleCreate(values);
                }
              }}
            />
          </DialogContent>
        </Dialog>

        <ResetPasswordDialog
          open={resetUserId !== null}
          userName={resetUserName}
          loading={resetPasswordMutation.isPending}
          onClose={() => {
            setResetUserId(null);
            setResetUserName(undefined);
          }}
          onConfirm={async () => {
            if (resetUserId) {
              await resetPasswordMutation.mutateAsync({ id: resetUserId });
              setResetUserId(null);
              setResetUserName(undefined);
            }
          }}
        />
      </div>

      <DataTableToolbar table={table}/>

      <div className="relative">
        {isLoading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/60 border">
            <Spinner className="h-5 w-5" />
          </div>
        )}
        <div className={isLoading ? "opacity-0" : ""} aria-hidden={isLoading}>
          <DataTable table={table}  />
        </div>
      </div>


    </div>
  );
}
