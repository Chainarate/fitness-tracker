import {
  format,
  parseISO,
  startOfWeek,
  endOfWeek,
  addDays,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameDay,
  isToday as fnsIsToday,
} from "date-fns";

/**
 * Helpers centered on `YYYY-MM-DD` "local date" strings, which is how
 * sessions/metrics are keyed in the DB. Times are tracked separately as ISO.
 */

/** Today's local calendar date as `YYYY-MM-DD`. */
export function todayLocal(): string {
  return format(new Date(), "yyyy-MM-dd");
}

export function toDateString(d: Date): string {
  return format(d, "yyyy-MM-dd");
}

export function fromDateString(s: string): Date {
  // Date-only ISO would parse as UTC midnight; parseISO with YYYY-MM-DD is local-safe in date-fns.
  return parseISO(s);
}

export function weekRange(d: Date, weekStartsOn: 0 | 1): { start: Date; end: Date; days: Date[] } {
  const start = startOfWeek(d, { weekStartsOn });
  const end = endOfWeek(d, { weekStartsOn });
  return { start, end, days: eachDayOfInterval({ start, end }) };
}

export function monthGrid(d: Date, weekStartsOn: 0 | 1): Date[] {
  // Returns full 6×7 grid of days that fill the month view.
  const start = startOfWeek(startOfMonth(d), { weekStartsOn });
  const end = endOfWeek(endOfMonth(d), { weekStartsOn });
  return eachDayOfInterval({ start, end });
}

export function shiftDays(d: Date, n: number): Date {
  return addDays(d, n);
}

export function sameDay(a: Date, b: Date): boolean {
  return isSameDay(a, b);
}

export function isToday(d: Date): boolean {
  return fnsIsToday(d);
}

export function prettyDate(s: string): string {
  return format(fromDateString(s), "EEE, MMM d");
}

export function prettyMonth(d: Date): string {
  return format(d, "MMMM yyyy");
}
