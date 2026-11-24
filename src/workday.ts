import { formatDateISO, getHolidays, isHoliday, parseToUTCDate } from './holidays.js';
import type { HolidayOptions } from './types.js';

const DEFAULT_WEEKEND_DAYS = [0, 6]; // Sunday & Saturday
const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const MAX_NEXT_WORKDAY_ITERATIONS = 3660;

/**
 * Checks whether a given date is a working day (neither a weekend nor a holiday).
 */
export function isWorkingDay(
  date: Date | string,
  options: HolidayOptions = {}
): boolean {
  const weekendDays = options.weekendDays ?? DEFAULT_WEEKEND_DAYS;
  const utcDate = parseToUTCDate(date);
  if (weekendDays.includes(utcDate.getUTCDay())) {
    return false;
  }
  return !isHoliday(utcDate, options);
}

/**
 * Returns the next working day strictly after the given date as a YYYY-MM-DD string.
 */
export function getNextWorkingDay(
  date: Date | string,
  options: HolidayOptions = {}
): string {
  const weekendDays = options.weekendDays ?? DEFAULT_WEEKEND_DAYS;
  if (new Set(weekendDays).size >= 7) {
    throw new RangeError('weekendDays cannot exclude all 7 days of the week');
  }

  let currentMs = parseToUTCDate(date).getTime() + ONE_DAY_MS;
  const holidayCache = new Map<number, Set<string>>();

  const getHolidaySet = (year: number): Set<string> => {
    let set = holidayCache.get(year);
    if (!set) {
      set = new Set(getHolidays(year, options).map((h) => h.date));
      holidayCache.set(year, set);
    }
    return set;
  };

  for (let i = 0; i < MAX_NEXT_WORKDAY_ITERATIONS; i++) {
    const currentDate = new Date(currentMs);
    const dayOfWeek = currentDate.getUTCDay();
    if (!weekendDays.includes(dayOfWeek)) {
      const iso = formatDateISO(currentDate);
      const year = currentDate.getUTCFullYear();
      if (!getHolidaySet(year).has(iso)) {
        return iso;
      }
    }
    currentMs += ONE_DAY_MS;
  }

  throw new Error('Could not find a working day within 10 years');
}

/**
 * Counts the number of working days between start and end dates (inclusive).
 * Returns 0 if start is after end.
 */
export function countWorkingDays(
  start: Date | string,
  end: Date | string,
  options: HolidayOptions = {}
): number {
  const weekendDays = options.weekendDays ?? DEFAULT_WEEKEND_DAYS;
  const startDate = parseToUTCDate(start);
  const endDate = parseToUTCDate(end);

  if (startDate.getTime() > endDate.getTime()) {
    return 0;
  }

  const holidayCache = new Map<number, Set<string>>();
  const getHolidaySet = (year: number): Set<string> => {
    let set = holidayCache.get(year);
    if (!set) {
      set = new Set(getHolidays(year, options).map((h) => h.date));
      holidayCache.set(year, set);
    }
    return set;
  };

  let count = 0;
  for (let ms = startDate.getTime(); ms <= endDate.getTime(); ms += ONE_DAY_MS) {
    const current = new Date(ms);
    if (weekendDays.includes(current.getUTCDay())) {
      continue;
    }
    const iso = formatDateISO(current);
    const year = current.getUTCFullYear();
    if (!getHolidaySet(year).has(iso)) {
      count++;
    }
  }

  return count;
}
