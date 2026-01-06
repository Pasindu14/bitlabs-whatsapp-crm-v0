"use client";

import { useState } from "react";
import { format } from "date-fns";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { DataTable } from "@/components/datatable/data-table";
import { DataTableToolbar } from "@/components/datatable/data-table-toolbar";
import { DataTableColumnHeader } from "@/components/datatable/data-table-column-header";
import { useWebhookEventLogs } from "../hooks/use-webhook-config";
import { CheckCircle2, XCircle, Clock, Eye, RefreshCw } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { createColumnHelper, getCoreRowModel, useReactTable } from "@tanstack/react-table";
import type { ColumnFiltersState, SortingState } from "@tanstack/react-table";
import { getSortedRowModel, getFilteredRowModel } from "@tanstack/react-table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface WebhookEventLogsProps {
  whatsappAccountId: number;
}

type WebhookEventLog = {
  id: number;
  eventType: string;
  eventTs: Date;
  objectId: string | null;
  processed: boolean;
  processedAt: Date | null;
  dedupKey: string;
  signature: string | null;
  payload: unknown;
  createdAt: Date;
};

const DEFAULT_PAGE_SIZE = 20;
const columnHelper = createColumnHelper<WebhookEventLog>();

export function WebhookEventLogs({ whatsappAccountId }: WebhookEventLogsProps) {
  const [processedFilter, setProcessedFilter] = useState<boolean | undefined>(undefined);
  const [sorting, setSorting] = useState<SortingState>([
    { id: "eventTs", desc: true },
  ]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);

  const { data, isLoading, error, hasNextPage, fetchNextPage, isFetchingNextPage, refetch } = useWebhookEventLogs(
    whatsappAccountId,
    { limit: pageSize, processed: processedFilter }
  );

  const pages = data?.pages ?? [];
  const hasMore = pages.length > 0 ? pages[pages.length - 1]?.hasMore ?? false : false;
  const currentPageData = pages[pageIndex]?.items ?? [];
  const totalCount = pages.reduce((acc, page) => acc + page.items.length, 0);
  const pageCount = pages.length + (hasMore ? 1 : 0) || 1;

  const getEventTypeBadge = (eventType: string) => {
    const config = {
      message: { variant: "default" as const, label: "Message", icon: CheckCircle2 },
      status: { variant: "secondary" as const, label: "Status", icon: Clock },
      other: { variant: "outline" as const, label: "Other", icon: XCircle },
    };
    const type = eventType as keyof typeof config;
    const { variant, label, icon: Icon } = config[type] || config.other;
    return (
      <Badge variant={variant} className="gap-1">
        <Icon className="h-3 w-3" />
        {label}
      </Badge>
    );
  };

  const getProcessedBadge = (processed: boolean) => {
    return processed ? (
      <Badge variant="outline" className="gap-1 text-green-600 border-green-600">
        <CheckCircle2 className="h-3 w-3" />
        Processed
      </Badge>
    ) : (
      <Badge variant="outline" className="gap-1 text-yellow-600 border-yellow-600">
        <Clock className="h-3 w-3" />
        Pending
      </Badge>
    );
  };

  const columns = [
    columnHelper.accessor("eventType", {
      header: ({ column }) => (
        <DataTableColumnHeader column={column} label="Event Type" />
      ),
      cell: (info) => getEventTypeBadge(info.getValue()),
      meta: {
        label: "Event Type",
        variant: "select",
        options: [
          { label: "Message", value: "message" },
          { label: "Status", value: "status" },
          { label: "Other", value: "other" },
        ],
      },
    }),
    columnHelper.accessor("eventTs", {
      header: ({ column }) => (
        <DataTableColumnHeader column={column} label="Event Time" />
      ),
      cell: (info) => format(info.getValue(), "MMM dd, yyyy HH:mm:ss"),
      meta: {
        label: "Event Time",
        variant: "date",
      },
    }),
    columnHelper.accessor("objectId", {
      header: ({ column }) => (
        <DataTableColumnHeader column={column} label="Object ID" />
      ),
      cell: (info) => info.getValue() || "-",
      meta: {
        label: "Object ID",
        variant: "text",
      },
    }),
    columnHelper.accessor("processed", {
      header: ({ column }) => (
        <DataTableColumnHeader column={column} label="Status" />
      ),
      cell: (info) => getProcessedBadge(info.getValue()),
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
          { label: "Processed", value: "true" },
          { label: "Pending", value: "false" },
        ],
      },
    }),
    columnHelper.accessor("payload", {
      header: "Actions",
      cell: (info) => {
        const item = info.row.original;
        return (
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <Eye className="h-4 w-4" />
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Event Payload</DialogTitle>
                <DialogDescription>
                  Raw webhook payload from Meta
                </DialogDescription>
              </DialogHeader>
              <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-xs">
                {JSON.stringify(item.payload, null, 2)}
              </pre>
            </DialogContent>
          </Dialog>
        );
      },
      enableSorting: false,
      enableHiding: false,
    }),
  ];

  const table = useReactTable({
    data: currentPageData,
    columns,
    state: {
      sorting,
      columnFilters,
    },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center min-h-[60vh]">
          <Spinner className="h-8 w-8" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="p-8 text-center text-destructive">
          Failed to load event logs
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Webhook Event Logs</CardTitle>
            <CardDescription>History of incoming webhook events from Meta</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <DataTableToolbar table={table} />
        <div className="relative">
          {isFetchingNextPage && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/60">
              <Spinner className="h-5 w-5" />
            </div>
          )}
          <div className={isFetchingNextPage ? "opacity-0" : ""} aria-hidden={isFetchingNextPage}>
            <DataTable table={table} showPagination={false} />
          </div>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between mt-4">
          <p className="text-sm text-muted-foreground">
            Displaying {currentPageData.length} of {totalCount} events
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
                  await fetchNextPage();
                }
                setPageIndex(nextIndex);
              }}
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
      </CardContent>
    </Card>
  );
}
