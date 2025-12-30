// Generic data table types
export interface GenericFilter {
    [key: string]: unknown;
}

export interface SortOption<T = unknown> {
    id: keyof T;
    desc: boolean;
}

export interface PaginationState {
    pageIndex: number;
    pageSize: number;
}

export interface DataResponse<T> {
    data: T[];
    totalCount: number;
    pageCount: number;
    currentPage: number;
}

export interface FetchParams {
    page: number;
    pageSize: number;
    search?: string;
    filters?: Record<string, unknown>;
    sortBy?: string;
}

// Generic filter configuration
export interface FilterConfig<T = unknown> {
    id: keyof T;
    type: 'select' | 'multiselect' | 'range' | 'date' | 'text';
    label: string;
    options?: { label: string; value: unknown; count?: number }[];
    placeholder?: string;
    icon?: React.ComponentType<{ className?: string }>;
}

// Filter component props
export interface GenericFilterProps {
    selectedValues: unknown[];
    onValuesChange: (values: unknown[]) => void;
    options: { label: string; value: unknown; count?: number }[];
    label: string;
    icon?: React.ComponentType<{ className?: string }>;
}

// Column configuration for any data type
export interface ColumnConfig<T = unknown> {
    id: keyof T;
    label: string;
    sortable?: boolean;
    hideable?: boolean;
    render?: (value: unknown, row: T) => React.ReactNode;
    className?: string;
}

// Generic action configuration
export interface ActionConfig<T = unknown> {
    id: string;
    label: string;
    icon?: React.ComponentType<{ className?: string }>;
    variant?: 'default' | 'destructive' | 'outline';
    onClick: (row: T) => void;
    disabled?: (row: T) => boolean;
}

export interface BulkActionConfig<T = unknown> {
    id: string;
    label: string;
    icon?: React.ComponentType<{ className?: string }>;
    variant?: 'default' | 'destructive' | 'outline';
    onClick: (selectedRows: T[]) => void;
}