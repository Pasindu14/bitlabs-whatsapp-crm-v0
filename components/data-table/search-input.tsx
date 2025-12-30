"use client";

import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, X } from "lucide-react";
import { useDebounce } from "use-debounce";

interface SearchInputProps {
  value: string;
  onSearchChange?: (value: string) => void;
  onValueChange?: (value: string) => void;
  placeholder?: string;
  isLoading?: boolean;
  disabled?: boolean;
  className?: string;
}

export function SearchInput({
  value,
  onSearchChange,
  onValueChange,
  placeholder = "Search titles...",
  isLoading = false,
  disabled = false,
  className,
}: SearchInputProps) {
  const [localValue, setLocalValue] = useState(value);
  const [debouncedValue] = useDebounce(localValue, 500);

  const handleChange = onValueChange || onSearchChange;

  // Update parent when debounced value changes
  useEffect(() => {
    handleChange?.(debouncedValue);
  }, [debouncedValue, handleChange]);

  // Update local value when prop changes (e.g., from URL)
  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  const handleClear = () => {
    setLocalValue("");
  };

  return (
    <div className={`relative ${className || "w-full"}`}>
      <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        placeholder={placeholder}
        value={localValue}
        onChange={(e) => setLocalValue(e.target.value)}
        className="pl-8 pr-8 w-full"
        disabled={isLoading || disabled}
      />
      {localValue && (
        <Button
          variant="ghost"
          size="sm"
          onClick={handleClear}
          className="absolute right-1 top-1/2 h-6 w-6 -translate-y-1/2 p-0"
        >
          <X className="h-3 w-3" />
          <span className="sr-only">Clear search</span>
        </Button>
      )}
      {isLoading && (
        <div className="absolute right-2 top-1/2 -translate-y-1/2">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-blue-600" />
        </div>
      )}
    </div>
  );
}
