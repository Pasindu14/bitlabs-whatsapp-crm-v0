"use client";

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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Pencil, RefreshCw, Search, Shuffle, X, XCircle } from "lucide-react";
import { useSession } from "next-auth/react";
import { useOrders, useUpdateOrderStatus, useDeactivateOrder } from "../hooks/order-hooks";
import type { OrderListInput, OrderResponse } from "../schemas/order-schema";
import { ORDER_STATUSES } from "../schemas/order-schema";
import { toast } from "sonner";
import { UpdateOrderDialog } from "./update-order-dialog";
import { UpdateStatusDialog } from "./update-status-dialog";

const DEFAULT_PAGE_SIZE = 20;
const columnHelper = createColumnHelper<OrderResponse>();

export function OrdersTable() {
  const session = useSession();
  const companyId = session.data?.user?.companyId 
    ? (typeof session.data.user.companyId === 'string' 
        ? parseInt(session.data.user.companyId, 10) 
        : session.data.user.companyId)
    : 0;

  const [sorting, setSorting] = React.useState<SortingState>([
    { id: "createdAt", desc: true },
  ]);
  const [columnVisibility, setColumnVisibility] = React.useState({});
  const [rowSelection, setRowSelection] = React.useState<RowSelectionState>({});
  const [pageIndex, setPageIndex] = React.useState(0);
  const [pageSize, setPageSize] = React.useState(DEFAULT_PAGE_SIZE);
  const [searchTerm, setSearchTerm] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState<(typeof ORDER_STATUSES)[number] | "all">("all");
  const [selectedOrder, setSelectedOrder] = React.useState<OrderResponse | null>(null);
  const [isUpdateDialogOpen, setIsUpdateDialogOpen] = React.useState(false);
  const [isStatusDialogOpen, setIsStatusDialogOpen] = React.useState(false);

  const queryParams = React.useMemo<OrderListInput>(() => {
    const cursor = pageIndex > 0 ? undefined : undefined;
    return {
      companyId,
      cursor,
      limit: pageSize,
      status: statusFilter === "all" ? undefined : statusFilter,
      searchTerm: searchTerm.trim() || undefined,
    };
  }, [companyId, pageIndex, pageSize, statusFilter, searchTerm]);

  const ordersQuery = useOrders(queryParams);
  const updateStatusMutation = useUpdateOrderStatus();
  const deactivateMutation = useDeactivateOrder();

  const isLoading = ordersQuery.isLoading || ordersQuery.isFetching || updateStatusMutation.isPending || deactivateMutation.isPending;

  const orders = ordersQuery.data?.orders ?? [];
  const hasMore = ordersQuery.data?.hasMore ?? false;
  const statusOptions: Array<(typeof ORDER_STATUSES)[number] | "all"> = ["all", ...ORDER_STATUSES];

  const handleUpdateOrder = (order: OrderResponse) => {
    setSelectedOrder(order);
    setIsUpdateDialogOpen(true);
  };

  const handleUpdateStatus = (order: OrderResponse) => {
    setSelectedOrder(order);
    setIsStatusDialogOpen(true);
  };

  const handleCancelOrder = async (orderId: number) => {
    try {
      await deactivateMutation.mutateAsync({
        orderId,
        companyId,
        userId: session.data?.user?.id ? parseInt(session.data.user.id, 10) : 0,
      });
      toast.success("Order cancelled");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to cancel order");
    }
  };

  const columns = React.useMemo(
    () => [
      columnHelper.accessor("id", {
        header: ({ column }) => (
          <DataTableColumnHeader column={column} label="ID" />
        ),
        cell: (info) => <span className="font-mono text-xs">{info.getValue()}</span>,
      }),
      columnHelper.accessor("customerName", {
        header: ({ column }) => (
          <DataTableColumnHeader column={column} label="Customer Name" />
        ),
        cell: (info) => (
          <div className="flex flex-col">
            <span className="font-medium">{info.getValue()}</span>
            <span className="text-xs text-muted-foreground">{info.row.original.customerPhone}</span>
          </div>
        ),
      }),
      columnHelper.accessor("status", {
        header: ({ column }) => (
          <DataTableColumnHeader column={column} label="Status" />
        ),
        cell: (info) => {
          const status = info.getValue();
          const colorMap: Record<string, string> = {
            draft: "bg-gray-100 text-gray-800",
            pending: "bg-yellow-100 text-yellow-800",
            confirmed: "bg-blue-100 text-blue-800",
            shipped: "bg-purple-100 text-purple-800",
            delivered: "bg-green-100 text-green-800",
            cancelled: "bg-red-100 text-red-800",
          };
          return (
            <Badge className={colorMap[status] || "bg-gray-100"}>
              {status.charAt(0).toUpperCase() + status.slice(1)}
            </Badge>
          );
        },
      }),
      columnHelper.accessor("deliveryAddress", {
        header: ({ column }) => (
          <DataTableColumnHeader column={column} label="Delivery Address" />
        ),
        cell: (info) => (
          <span className="text-sm max-w-[200px] truncate block">
            {info.getValue()}
          </span>
        ),
      }),
      columnHelper.accessor("orderDescription", {
        header: ({ column }) => (
          <DataTableColumnHeader column={column} label="Description" />
        ),
        cell: (info) => (
          <span className="text-sm max-w-[250px] truncate block">
            {info.getValue()}
          </span>
        ),
      }),
      columnHelper.accessor("createdAt", {
        header: ({ column }) => (
          <DataTableColumnHeader column={column} label="Created At" />
        ),
        cell: (info) => (
          <span className="text-sm text-muted-foreground">
            {format(new Date(info.getValue()), "MMM d, yyyy")}
          </span>
        ),
      }),
      columnHelper.accessor("id", {
        id: "actions",
        header: "Actions",
        cell: (info) => {
          const order = info.row.original;
          return (
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleUpdateOrder(order)}
                                disabled={order.status === "delivered" || order.status === "cancelled"}
                className="h-8 text-xs gap-1.5"
              >
                <Pencil className="h-4 w-4" />
                Update Data
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleUpdateStatus(order)}
                disabled={order.status === "delivered" || order.status === "cancelled"}
                className="h-8 text-xs gap-1.5"
              >
                <Shuffle className="h-4 w-4" />
                Update Status
              </Button>
              {order.status !== "cancelled" && (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => handleCancelOrder(order.id)}
                  className="h-8 text-xs gap-1.5"
                >
                  <XCircle className="h-4 w-4" />
                  Cancel
                </Button>
              )}
            </div>
          );
        },
      }),
    ],
    [handleUpdateOrder, handleUpdateStatus, handleCancelOrder]
  );

  const table = useReactTable({
    data: orders,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onSortingChange: setSorting,
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    state: {
      sorting,
      columnVisibility,
      rowSelection,
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Button
          variant="outline"
          size="icon"
          onClick={() => ordersQuery.refetch()}
          disabled={ordersQuery.isFetching}
        >
          <RefreshCw className="h-4 w-4" />
          <span className="sr-only">Refresh</span>
        </Button>

        <div className="relative w-full max-w-xs">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Filter by name or description"
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setPageIndex(0);
            }}
            className="pl-9"
          />
        </div>

        <Select
          value={statusFilter}
          onValueChange={(value) => {
            setStatusFilter(value as (typeof ORDER_STATUSES)[number] | "all");
            setPageIndex(0);
          }}
        >
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            {statusOptions.map((status) => (
              <SelectItem key={status} value={status}>
                {status === "all"
                  ? "All statuses"
                  : status.charAt(0).toUpperCase() + status.slice(1)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setSearchTerm("");
            setStatusFilter("all");
            setPageIndex(0);
          }}
          className="gap-1.5"
        >
          <X className="h-4 w-4" />
          Reset
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-8 border dash-border">
          <Spinner />
        </div>
      ) : orders.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground border dash-border">
          No orders found
        </div>
      ) : (
        <DataTable table={table} />
      )}
      {orders.length > 0 && (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">
            Showing {orders.length} orders
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
              disabled={!hasMore}
              onClick={() => setPageIndex((prev) => prev + 1)}
            >
              Next
            </Button>
            <Select
              value={`${pageSize}`}
              onValueChange={(value: string) => {
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
      )}
      {selectedOrder && (
        <>
          <UpdateOrderDialog
            isOpen={isUpdateDialogOpen}
            onClose={() => setIsUpdateDialogOpen(false)}
            orderId={selectedOrder.id}
            currentData={{
              customerName: selectedOrder.customerName,
              customerPhone: selectedOrder.customerPhone,
              deliveryAddress: selectedOrder.deliveryAddress,
              orderDescription: selectedOrder.orderDescription,
              notes: selectedOrder.notes || '',
            }}
          />
          <UpdateStatusDialog
            isOpen={isStatusDialogOpen}
            onClose={() => setIsStatusDialogOpen(false)}
            orderId={selectedOrder.id}
            currentStatus={selectedOrder.status}
          />
        </>
      )}
    </div>
  );
}
