"use client";

import { format } from "date-fns";
import { cn } from "@/lib/utils";
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { ClockIcon } from "lucide-react";
import type { Control, FieldPath, FieldValues } from "react-hook-form";
import { TimePickerInput } from "./time-only-picker";
import { setDateByType } from "./time-picker-utils";
import { useState } from "react";

interface TimePickerFormFieldProps<T extends FieldValues> {
  control: Control<T>;
  name: FieldPath<T>;
  label?: string;
  placeholder?: string;
  disabled?: boolean;
}

export function TimePickerFormField<T extends FieldValues>({
  control,
  name,
  label = "Time",
  placeholder = "HH:mm",
  disabled = false,
}: TimePickerFormFieldProps<T>) {
  const [open, setOpen] = useState(false);

  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => {
        // Convert time string (HH:mm) to Date for the picker
        const getDateFromTimeString = (
          timeString: string | undefined
        ): Date => {
          if (timeString && /^\d{2}:\d{2}$/.test(timeString)) {
            const [hours, minutes] = timeString.split(":").map(Number);
            const date = new Date();
            date.setHours(hours, minutes, 0, 0);
            return date;
          }
          return new Date(new Date().setHours(9, 0, 0, 0)); // Default to 09:00
        };

        // Convert Date to time string (HH:mm)
        const getTimeStringFromDate = (date: Date | undefined): string => {
          if (!date || isNaN(date.getTime())) return "";
          return format(date, "HH:mm");
        };

        const timeValue = field.value as string | undefined;
        const dateValue = getDateFromTimeString(timeValue);

        const handleTimeChange = (newDate: Date | undefined) => {
          if (!newDate) return;
          const timeString = getTimeStringFromDate(newDate);
          field.onChange(timeString);
        };

        const handleHourChange = (value: string) => {
          const newDate = new Date(dateValue);
          setDateByType(newDate, value, "hours");
          handleTimeChange(newDate);
        };

        const handleMinuteChange = (value: string) => {
          const newDate = new Date(dateValue);
          setDateByType(newDate, value, "minutes");
          handleTimeChange(newDate);
        };

        return (
          <FormItem className="flex flex-col">
            <FormLabel>{label}</FormLabel>
            <Popover open={open} onOpenChange={setOpen}>
              <PopoverTrigger asChild>
                <FormControl>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full pl-3 text-left font-normal",
                      !field.value && "text-muted-foreground"
                    )}
                    disabled={disabled}
                    type="button"
                  >
                    {field.value ? (
                      <span className="font-mono">{field.value}</span>
                    ) : (
                      <span>{placeholder}</span>
                    )}
                    <ClockIcon className="ml-auto h-4 w-4 opacity-50" />
                  </Button>
                </FormControl>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <div className="flex items-center gap-2 p-3">
                  <div className="flex items-center gap-1">
                    <TimePickerInput
                      picker="hours"
                      date={dateValue}
                      setDate={handleTimeChange}
                      onRightFocus={() => {}}
                    />
                    <span className="text-lg font-semibold">:</span>
                    <TimePickerInput
                      picker="minutes"
                      date={dateValue}
                      setDate={handleTimeChange}
                      onLeftFocus={() => {}}
                    />
                  </div>
                </div>
                <div className="flex flex-col sm:flex-row sm:h-[300px] divide-y sm:divide-y-0 sm:divide-x border-t">
                  <ScrollArea className="w-64 sm:w-auto">
                    <div className="flex sm:flex-col p-2">
                      {Array.from({ length: 24 }, (_, i) => i)
                        .reverse()
                        .map((hour) => (
                          <Button
                            key={hour}
                            size="icon"
                            variant={
                              dateValue.getHours() === hour
                                ? "default"
                                : "ghost"
                            }
                            className="sm:w-full shrink-0 aspect-square"
                            onClick={() => {
                              handleHourChange(
                                hour.toString().padStart(2, "0")
                              );
                            }}
                            disabled={disabled}
                            type="button"
                          >
                            {hour.toString().padStart(2, "0")}
                          </Button>
                        ))}
                    </div>
                    <ScrollBar orientation="horizontal" className="sm:hidden" />
                  </ScrollArea>
                  <ScrollArea className="w-64 sm:w-auto">
                    <div className="flex sm:flex-col p-2">
                      {Array.from({ length: 12 }, (_, i) => i * 5).map(
                        (minute) => (
                          <Button
                            key={minute}
                            size="icon"
                            variant={
                              dateValue.getMinutes() === minute
                                ? "default"
                                : "ghost"
                            }
                            className="sm:w-full shrink-0 aspect-square"
                            onClick={() => {
                              handleMinuteChange(
                                minute.toString().padStart(2, "0")
                              );
                            }}
                            disabled={disabled}
                            type="button"
                          >
                            {minute.toString().padStart(2, "0")}
                          </Button>
                        )
                      )}
                    </div>
                    <ScrollBar orientation="horizontal" className="sm:hidden" />
                  </ScrollArea>
                </div>
              </PopoverContent>
            </Popover>
            <FormMessage />
          </FormItem>
        );
      }}
    />
  );
}
