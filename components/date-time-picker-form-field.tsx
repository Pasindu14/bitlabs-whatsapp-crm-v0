"use client";

import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
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
import { Calendar1Icon } from "lucide-react";
import type {
  Control,
  FieldPath,
  FieldValues,
} from "react-hook-form";

interface DateTimePickerFormFieldProps<T extends FieldValues> {
  control: Control<T>;
  name: FieldPath<T>;
  label?: string;
  placeholder?: string;
  disabled?: boolean;
}

export function DateTimePickerFormField<T extends FieldValues>({
  control,
  name,
  label = "Date & Time",
  placeholder = "MM/DD/YYYY HH:mm",
  disabled = false,
}: DateTimePickerFormFieldProps<T>) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => {
        const handleDateSelect = (date: Date | undefined) => {
          if (date) {
            // Preserve the time from the current value if it exists
            const currentValue = field.value as Date | undefined;
            if (currentValue && !isNaN(currentValue.getTime())) {
              const newDate = new Date(date);
              newDate.setHours(currentValue.getHours());
              newDate.setMinutes(currentValue.getMinutes());
              newDate.setSeconds(currentValue.getSeconds());
              field.onChange(newDate);
            } else {
              // If no current value, set to selected date with current time
              const newDate = new Date(date);
              const now = new Date();
              newDate.setHours(now.getHours());
              newDate.setMinutes(now.getMinutes());
              newDate.setSeconds(0);
              field.onChange(newDate);
            }
          }
        };

        const handleTimeChange = (type: "hour" | "minute", value: string) => {
          const currentDate = (field.value as Date | undefined) || new Date();
          const newDate = new Date(currentDate);

          if (type === "hour") {
            const hour = parseInt(value, 10);
            newDate.setHours(hour);
          } else if (type === "minute") {
            newDate.setMinutes(parseInt(value, 10));
          }

          field.onChange(newDate);
        };

        return (
          <FormItem className="flex flex-col">
            <FormLabel>{label}</FormLabel>
            <Popover>
              <PopoverTrigger asChild>
                <FormControl>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full pl-3 text-left font-normal",
                      !field.value && "text-muted-foreground"
                    )}
                    disabled={disabled}
                  >
                    {field.value ? (
                      format(field.value as Date, "MM/dd/yyyy HH:mm")
                    ) : (
                      <span>{placeholder}</span>
                    )}
                    <Calendar1Icon className="ml-auto h-4 w-4 opacity-50" />
                  </Button>
                </FormControl>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <div className="sm:flex">
                  <Calendar
                    mode="single"
                    selected={field.value ? (field.value as Date) : undefined}
                    onSelect={handleDateSelect}
                    initialFocus
                  />
                  <div className="flex flex-col sm:flex-row sm:h-[300px] divide-y sm:divide-y-0 sm:divide-x">
                    <ScrollArea className="w-64 sm:w-auto">
                      <div className="flex sm:flex-col p-2">
                        {Array.from({ length: 24 }, (_, i) => i)
                          .reverse()
                          .map((hour) => (
                            <Button
                              key={hour}
                              size="icon"
                              variant={
                                field.value &&
                                !isNaN((field.value as Date).getTime()) &&
                                (field.value as Date).getHours() === hour
                                  ? "default"
                                  : "ghost"
                              }
                              className="sm:w-full shrink-0 aspect-square"
                              onClick={() =>
                                handleTimeChange("hour", hour.toString())
                              }
                              disabled={disabled}
                            >
                              {hour}
                            </Button>
                          ))}
                      </div>
                      <ScrollBar
                        orientation="horizontal"
                        className="sm:hidden"
                      />
                    </ScrollArea>
                    <ScrollArea className="w-64 sm:w-auto">
                      <div className="flex sm:flex-col p-2">
                        {Array.from({ length: 12 }, (_, i) => i * 5).map(
                          (minute) => (
                            <Button
                              key={minute}
                              size="icon"
                              variant={
                                field.value &&
                                !isNaN((field.value as Date).getTime()) &&
                                (field.value as Date).getMinutes() === minute
                                  ? "default"
                                  : "ghost"
                              }
                              className="sm:w-full shrink-0 aspect-square"
                              onClick={() =>
                                handleTimeChange("minute", minute.toString())
                              }
                              disabled={disabled}
                            >
                              {minute.toString().padStart(2, "0")}
                            </Button>
                          )
                        )}
                      </div>
                      <ScrollBar
                        orientation="horizontal"
                        className="sm:hidden"
                      />
                    </ScrollArea>
                  </div>
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

