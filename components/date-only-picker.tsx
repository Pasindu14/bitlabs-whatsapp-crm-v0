"use client";

import * as React from "react";
import { CalendarIcon } from "lucide-react";
import type { ControllerRenderProps, FieldValues } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

function formatDate(date: Date | undefined) {
  if (!date) {
    return "";
  }

  return date.toLocaleDateString("en-US", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function formatDateString(dateString: string | undefined): string {
  if (!dateString) {
    return "";
  }
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) {
      return "";
    }
    return formatDate(date);
  } catch {
    return "";
  }
}

function parseDateString(dateString: string | undefined): Date | undefined {
  if (!dateString) {
    return undefined;
  }
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) {
      return undefined;
    }
    return date;
  } catch {
    return undefined;
  }
}

function dateToYYYYMMDD(date: Date | undefined): string {
  if (!date) {
    return "";
  }
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function isValidDate(date: Date | undefined) {
  if (!date) {
    return false;
  }
  return !isNaN(date.getTime());
}

// Standalone DateOnlyPicker component (for backwards compatibility)
export function DateOnlyPicker() {
  const [open, setOpen] = React.useState(false);
  const [date, setDate] = React.useState<Date | undefined>(
    new Date("2025-06-01")
  );
  const [month, setMonth] = React.useState<Date | undefined>(date);
  const [value, setValue] = React.useState(formatDate(date));

  return (
    <div className="flex flex-col gap-3">
      <Label htmlFor="date" className="px-1">
        Subscription Date
      </Label>
      <div className="relative flex gap-2">
        <Input
          id="date"
          value={value}
          placeholder="June 01, 2025"
          className="bg-background pr-10"
          onChange={(e) => {
            const date = new Date(e.target.value);
            setValue(e.target.value);
            if (isValidDate(date)) {
              setDate(date);
              setMonth(date);
            }
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setOpen(true);
            }
          }}
        />
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              id="date-picker"
              variant="ghost"
              className="absolute top-1/2 right-2 size-6 -translate-y-1/2"
            >
              <CalendarIcon className="size-3.5" />
              <span className="sr-only">Select date</span>
            </Button>
          </PopoverTrigger>
          <PopoverContent
            className="w-auto overflow-hidden p-0"
            align="end"
            alignOffset={-8}
            sideOffset={10}
          >
            <Calendar
              mode="single"
              selected={date}
              captionLayout="dropdown"
              month={month}
              onMonthChange={setMonth}
              onSelect={(date) => {
                setDate(date);
                setValue(formatDate(date));
                setOpen(false);
              }}
            />
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
}

// Form field version for react-hook-form integration
interface DateOnlyPickerFieldProps<T extends FieldValues> {
  field: ControllerRenderProps<T>;
  placeholder?: string;
  disabled?: boolean;
}

export function DateOnlyPickerField<T extends FieldValues>({
  field,
  placeholder = "Select date",
  disabled = false,
}: DateOnlyPickerFieldProps<T>) {
  const [open, setOpen] = React.useState(false);

  // Convert string value (YYYY-MM-DD) to Date object
  const dateValue = React.useMemo(() => {
    return parseDateString(field.value as string | undefined);
  }, [field.value]);

  // Initialize month from date value, or current date if no value
  const [month, setMonth] = React.useState<Date | undefined>(
    dateValue || new Date()
  );

  // Format the date string for display
  const displayValue = React.useMemo(() => {
    return formatDateString(field.value as string | undefined);
  }, [field.value]);

  // Handle calendar date selection
  const handleSelect = (date: Date | undefined) => {
    if (!date) {
      field.onChange(undefined);
      return;
    }

    // Convert Date to YYYY-MM-DD string format
    const dateString = dateToYYYYMMDD(date);
    field.onChange(dateString);
    setOpen(false);
  };

  // Handle manual input change
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputValue = e.target.value;

    // Try to parse as date string (YYYY-MM-DD) or natural date format
    if (inputValue) {
      const parsedDate = new Date(inputValue);
      if (isValidDate(parsedDate)) {
        const dateString = dateToYYYYMMDD(parsedDate);
        field.onChange(dateString);
        setMonth(parsedDate);
      }
    } else {
      field.onChange(undefined);
    }
  };

  // Update month when date value changes externally
  React.useEffect(() => {
    if (dateValue) {
      setMonth(dateValue);
    }
  }, [dateValue]);

  return (
    <div className="relative flex gap-2">
      <Input
        value={displayValue}
        placeholder={placeholder}
        className="bg-background pr-10"
        onChange={handleInputChange}
        disabled={disabled}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setOpen(true);
          }
        }}
      />
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            className="absolute top-1/2 right-2 size-6 -translate-y-1/2"
            disabled={disabled}
          >
            <CalendarIcon className="size-3.5" />
            <span className="sr-only">Select date</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className="w-auto overflow-hidden p-0"
          align="end"
          alignOffset={-8}
          sideOffset={10}
        >
          <Calendar
            mode="single"
            selected={dateValue}
            captionLayout="dropdown"
            month={month}
            onMonthChange={setMonth}
            onSelect={handleSelect}
            disabled={disabled}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}
