"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ChevronDown, Eye } from "lucide-react";
import { VisibilityState } from "@tanstack/react-table";

interface ViewControlProps {
  columnVisibility: VisibilityState;
  onColumnVisibilityChange: (
    visibility: VisibilityState | ((old: VisibilityState) => VisibilityState)
  ) => void;
  columns?: { id: string; label: string; hideable?: boolean }[];
}

export function ViewControl({
  columnVisibility,
  onColumnVisibilityChange,
  columns = [],
}: ViewControlProps) {
  const [isOpen, setIsOpen] = useState(false);

  // Filter out columns that shouldn't be hideable (like selection column)
  const hideableColumns = columns
    ? columns.filter((col) => col.hideable !== false)
    : [];

  const handleToggleColumn = (columnId: string) => {
    const newVisibility = {
      ...columnVisibility,
      [columnId]: !columnVisibility[columnId],
    };
    onColumnVisibilityChange(newVisibility);
  };

  const visibleCount = hideableColumns.filter(
    (col) => columnVisibility[col.id] !== false
  ).length;
  const totalCount = hideableColumns.length;

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm">
          <Eye className="mr-2 h-4 w-4" />
          View
          <ChevronDown className="ml-2 h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-48" align="start">
        <DropdownMenuLabel>Toggle Columns</DropdownMenuLabel>
        <DropdownMenuSeparator />

        <div className="p-2 space-y-2">
          {hideableColumns.length === 0 ? (
            <div className="text-sm text-muted-foreground p-2">
              No columns available
            </div>
          ) : (
            hideableColumns.map((column) => {
              const isVisible = columnVisibility[column.id] !== false;
              const isLastVisible = visibleCount === 1 && isVisible;

              return (
                <div key={column.id} className="flex items-center space-x-2">
                  <Checkbox
                    id={`column-${column.id}`}
                    checked={isVisible}
                    onCheckedChange={() => handleToggleColumn(column.id)}
                    disabled={isLastVisible} // Prevent hiding the last visible column
                  />
                  <label
                    htmlFor={`column-${column.id}`}
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                  >
                    {column.label}
                  </label>
                </div>
              );
            })
          )}
        </div>

        <DropdownMenuSeparator />
        <div className="p-2 text-xs text-muted-foreground">
          {visibleCount} of {totalCount} columns visible
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
