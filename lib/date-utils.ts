import { format, parseISO, startOfDay, isValid } from "date-fns";

/**
 * Converts a Date object to YYYY-MM-DD string format for PostgreSQL date columns
 * @param date - Date object to convert
 * @returns String in YYYY-MM-DD format, or empty string if invalid
 */
export function dateToDbString(date: Date | string | null | undefined): string {
  if (!date) return "";
  
  try {
    const dateObj = typeof date === "string" ? parseISO(date) : date;
    
    if (!isValid(dateObj)) {
      return "";
    }
    
    return format(dateObj, "yyyy-MM-dd");
  } catch {
    return "";
  }
}

/**
 * Converts a database date string (YYYY-MM-DD) to a Date object
 * @param dateString - Date string from database
 * @returns Date object, or null if invalid
 */
export function dbStringToDate(
  dateString: string | null | undefined
): Date | null {
  if (!dateString) return null;
  
  try {
    const date = parseISO(dateString);
    
    if (!isValid(date)) {
      return null;
    }
    
    return date;
  } catch {
    return null;
  }
}

/**
 * Normalizes a date to the start of day (00:00:00) for accurate date comparisons
 * @param date - Date object to normalize
 * @returns New Date object set to start of day
 */
export function normalizeToStartOfDay(date: Date): Date {
  return startOfDay(date);
}

/**
 * Compares two dates by their date value only (ignoring time)
 * @param date1 - First date
 * @param date2 - Second date
 * @returns true if dates are the same day, false otherwise
 */
export function isSameDate(date1: Date | string, date2: Date | string): boolean {
  try {
    const d1 = typeof date1 === "string" ? parseISO(date1) : date1;
    const d2 = typeof date2 === "string" ? parseISO(date2) : date2;
    
    if (!isValid(d1) || !isValid(d2)) {
      return false;
    }
    
    const normalized1 = normalizeToStartOfDay(d1);
    const normalized2 = normalizeToStartOfDay(d2);
    
    return normalized1.getTime() === normalized2.getTime();
  } catch {
    return false;
  }
}

/**
 * Formats a date for display in a consistent format
 * @param date - Date object or string to format
 * @param formatStr - Format string (default: "PPP" for "January 1st, 2024")
 * @returns Formatted date string
 */
export function formatDateForDisplay(
  date: Date | string | null | undefined,
  formatStr: string = "PPP"
): string {
  if (!date) return "";
  
  try {
    const dateObj = typeof date === "string" ? parseISO(date) : date;
    
    if (!isValid(dateObj)) {
      return "";
    }
    
    return format(dateObj, formatStr);
  } catch {
    return "";
  }
}

/**
 * Formats a date for table display (short format)
 * @param date - Date object or string to format
 * @returns Formatted date string (e.g., "01/01/2024")
 */
export function formatDateForTable(
  date: Date | string | null | undefined
): string {
  return formatDateForDisplay(date, "MM/dd/yyyy");
}

