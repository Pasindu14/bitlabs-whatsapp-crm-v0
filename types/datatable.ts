import type { ColumnMeta, RowData } from "@tanstack/react-table";

declare module "@tanstack/react-table" {
  // biome-ignore lint/correctness/noUnusedVariables: TData and TValue are used in the ColumnMeta interface
  interface ColumnMeta<TData extends RowData, TValue> {
    label?: string;
    placeholder?: string;
    variant?: "text" | "number" | "range" | "date" | "dateRange" | "select" | "multiSelect";
    options?: Array<{
      label: string;
      value: string;
      count?: number;
      icon?: React.FC<React.SVGProps<SVGSVGElement>>;
    }>;
    range?: [number, number];
    unit?: string;
    icon?: React.FC<React.SVGProps<SVGSVGElement>>;
  }
}

export interface Option {
  label: string;
  value: string;
  count?: number;
  icon?: React.FC<React.SVGProps<SVGSVGElement>>;
}
