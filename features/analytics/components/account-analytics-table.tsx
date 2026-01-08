'use client';

import * as React from 'react';
import { useSession } from 'next-auth/react';
import { getCoreRowModel, getSortedRowModel, useReactTable, type ColumnDef, type SortingState } from '@tanstack/react-table';
import { startOfMonth, endOfMonth, format } from 'date-fns';
import { Search, RefreshCw, X, BarChart3 } from 'lucide-react';

import { DataTable } from '@/components/datatable/data-table';
import { DataTableColumnHeader } from '@/components/datatable/data-table-column-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Spinner } from '@/components/ui/spinner';
import { ControlledDateOnlyPicker } from '@/components/date-only-picker';
import { useAccountAnalytics } from '../hooks/analytics-hooks';
import type { AccountAnalyticsListInput, AccountAnalyticsItem } from '../schemas/analytics-schema';
import { ACCOUNT_STATUS } from '../schemas/analytics-schema';

const DEFAULT_PAGE_SIZE = 20;

export function AccountAnalyticsTable() {
  const session = useSession();
  const companyId = session.data?.user?.companyId 
    ? (typeof session.data.user.companyId === 'string' 
        ? parseInt(session.data.user.companyId, 10) 
        : session.data.user.companyId)
    : 0;

  const [sorting, setSorting] = React.useState<SortingState>([
    { id: 'receivedCount', desc: true },
  ]);
  const [pageIndex, setPageIndex] = React.useState(0);
  const [pageSize, setPageSize] = React.useState(DEFAULT_PAGE_SIZE);
  const [searchTerm, setSearchTerm] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState<(typeof ACCOUNT_STATUS)[number] | 'all'>('all');
  
  const now = new Date();
  const [startDate, setStartDate] = React.useState(format(startOfMonth(now), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = React.useState(format(endOfMonth(now), 'yyyy-MM-dd'));

  const queryParams = React.useMemo<AccountAnalyticsListInput>(() => {
    return {
      companyId,
      cursor: undefined,
      limit: pageSize,
      status: statusFilter === 'all' ? undefined : statusFilter,
      searchTerm: searchTerm.trim() || undefined,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
    };
  }, [companyId, pageSize, statusFilter, searchTerm, startDate, endDate]);

  const analyticsQuery = useAccountAnalytics(queryParams);

  const isLoading = analyticsQuery.isLoading || analyticsQuery.isFetching;
  const accounts = analyticsQuery.data?.accounts ?? [];
  const hasMore = analyticsQuery.data?.hasMore ?? false;

  const handleReset = () => {
    setSearchTerm('');
    setStatusFilter('all');
    setStartDate('');
    setEndDate('');
    setPageIndex(0);
  };

  const columns: ColumnDef<AccountAnalyticsItem>[] = [
    {
      accessorKey: 'name',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} label="Account Name" />
      ),
      cell: (info) => (
        <div className="flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium">{info.getValue() as string}</span>
        </div>
      ),
    },
    {
      accessorKey: 'phone',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} label="Phone Number" />
      ),
      cell: (info) => (
        <span className="text-sm text-muted-foreground">{info.getValue() as string}</span>
      ),
    },
    {
      accessorKey: 'receivedCount',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} label="Received" />
      ),
      cell: (info) => (
        <Badge variant="secondary" className="bg-blue-100 text-blue-800 hover:bg-blue-200">
          {info.getValue() as number}
        </Badge>
      ),
    },
    {
      accessorKey: 'sentCount',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} label="Sent" />
      ),
      cell: (info) => (
        <Badge variant="secondary" className="bg-green-100 text-green-800 hover:bg-green-200">
          {info.getValue() as number}
        </Badge>
      ),
    },
    {
      accessorKey: 'isActive',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} label="Status" />
      ),
      cell: (info) => (
        <Badge variant={(info.getValue() as boolean) ? 'default' : 'secondary'}>
          {(info.getValue() as boolean) ? 'Active' : 'Inactive'}
        </Badge>
      ),
    },
  ];

  const table = useReactTable({
    data: accounts,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    onSortingChange: setSorting,
    state: {
      sorting,
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Button
          variant="outline"
          size="icon"
          onClick={() => analyticsQuery.refetch()}
          disabled={analyticsQuery.isFetching}
        >
          <RefreshCw className="h-4 w-4" />
          <span className="sr-only">Refresh</span>
        </Button>

        <div className="relative w-full max-w-xs">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Filter by name or phone"
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
            setStatusFilter(value as (typeof ACCOUNT_STATUS)[number] | 'all');
            setPageIndex(0);
          }}
        >
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            {ACCOUNT_STATUS.map((status) => (
              <SelectItem key={status} value={status}>
                {status.charAt(0).toUpperCase() + status.slice(1)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="w-[10vw]">
          <ControlledDateOnlyPicker
            value={startDate}
            onChange={(value) => {
              setStartDate(value || '');
              setPageIndex(0);
            }}
            placeholder="Start date"
          />
        </div>

        <div className="w-[10vw]">
          <ControlledDateOnlyPicker
            value={endDate}
            onChange={(value) => {
              setEndDate(value || '');
              setPageIndex(0);
            }}
            placeholder="End date"
          />
        </div>

        <Button
          variant="ghost"
          size="sm"
          onClick={handleReset}
          className="gap-1.5"
        >
          <X className="h-4 w-4" />
          Reset
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-8 border">
          <Spinner />
        </div>
      ) : accounts.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          No analytics data found
        </div>
      ) : (
        <DataTable table={table} />
      )}

    </div>
  );
}
