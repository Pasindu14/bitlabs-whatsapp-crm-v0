"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Checkbox } from "@/components/ui/checkbox";
import { ChevronDown, X } from "lucide-react";
import { GenericFilterProps } from "@/lib/generic-table-types";

export function GenericMultiSelectFilter({
  selectedValues,
  onValuesChange,
  options,
  label,
  icon: Icon,
}: GenericFilterProps) {
  const handleValueToggle = (value: unknown, checked: boolean) => {
    if (checked) {
      onValuesChange([...selectedValues, value]);
    } else {
      onValuesChange(selectedValues.filter((v: unknown) => v !== value));
    }
  };

  const clearFilters = () => {
    onValuesChange([]);
  };

  const selectedCount = selectedValues.length;
  const hasFilters = selectedCount > 0;

  return (
    <div className="flex items-center gap-2">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className={`h-8 border-dashed ${
              hasFilters ? "border-solid bg-accent" : ""
            }`}
          >
            {Icon && <Icon className="mr-2 h-4 w-4" />}
            {label}
            {hasFilters && (
              <Badge
                variant="secondary"
                className="ml-2 rounded-sm px-1 font-normal"
              >
                {selectedCount}
              </Badge>
            )}
            <ChevronDown className="ml-2 h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-[200px] p-0" align="start">
          <div className="max-h-64 overflow-auto">
            <div className="p-2">
              {options.map((option) => {
                const isSelected = selectedValues.includes(option.value);
                return (
                  <div
                    key={option.value as string}
                    className="flex items-center space-x-2 px-2 py-1.5 hover:bg-accent rounded cursor-pointer"
                    onClick={() => handleValueToggle(option.value, !isSelected)}
                  >
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={(checked) =>
                        handleValueToggle(option.value, !!checked)
                      }
                    />
                    <span className="flex-1 text-sm">{option.label}</span>
                    {option.count !== undefined && (
                      <span className="text-xs text-muted-foreground">
                        {option.count}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </DropdownMenuContent>
      </DropdownMenu>

      {hasFilters && (
        <Button
          variant="ghost"
          size="sm"
          onClick={clearFilters}
          className="h-8 px-2 lg:px-3"
        >
          Reset
          <X className="ml-2 h-4 w-4" />
        </Button>
      )}
    </div>
  );
}
