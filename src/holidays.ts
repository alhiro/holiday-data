import data2025 from '../data/id/2025.json';
import data2026 from '../data/id/2026.json';
import data2027 from '../data/id/2027.json';
import type { CountryCode, Holiday, HolidayOptions } from './types.js';

const DATASET: Record<CountryCode, Record<number, Holiday[]>> = {
  ID: {
    2025: data2025 as Holiday[],
    2026: data2026 as Holiday[],
    2027: data2027 as Holiday[],
  },
};

const ISO_DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * Parses a Date or YYYY-MM-DD string into a UTC Date at 00:00:00.000Z.
 */
export function parseToUTCDate(input: Date | string): Date {
  if (input instanceof Date) {
    if (Number.isNaN(input.getTime())) {
      throw new RangeError('Invalid Date provided');
    }
    return new Date(
      Date.UTC(input.getUTCFullYear(), input.getUTCMonth(), input.getUTCDate())
    );
  }

  if (typeof input === 'string') {
    const trimmed = input.trim();
    const match = ISO_DATE_RE.exec(trimmed);
    if (match) {
      const year = Number(match[1]);
      const month = Number(match[2]);
      const day = Number(match[3]);
      const d = new Date(Date.UTC(year, month - 1, day));
      if (
        d.getUTCFullYear() === year &&
        d.getUTCMonth() === month - 1 &&
        d.getUTCDate() === day
      ) {
        return d;
      }
      throw new RangeError(`Invalid calendar date: "${input}"`);
    }

    const parsed = new Date(trimmed);
    if (!Number.isNaN(parsed.getTime())) {
      return new Date(
        Date.UTC(parsed.getUTCFullYear(), parsed.getUTCMonth(), parsed.getUTCDate())
      );
    }
  }

  throw new RangeError(`Invalid date string: "${String(input)}"`);
}

/**
 * Formats a UTC Date or date input into a YYYY-MM-DD string.
 */
export function formatDateISO(input: Date | string): string {
  const d = parseToUTCDate(input);
  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Returns the list of years available for a given country.
 */
export function getAvailableYears(country: CountryCode = 'ID'): number[] {
  const countryData = DATASET[country];
  if (!countryData) return [];
  return Object.keys(countryData)
    .map(Number)
    .sort((a, b) => a - b);
}

/**
 * Returns all holidays for a given year filtered by country, calendar variant, and joint leave option.
 */
export function getHolidays(year: number, options: HolidayOptions = {}): Holiday[] {
  const {
    country = 'ID',
    calendar = 'skb',
    includeJointLeave = true,
  } = options;

  const yearData = DATASET[country]?.[year];
  if (!yearData) {
    return [];
  }

  return yearData
    .filter((holiday) => {
      const holidayCal = holiday.calendar ?? 'all';
      const matchesCalendar = holidayCal === 'all' || holidayCal === calendar;
      const matchesJointLeave = includeJointLeave || !holiday.isJointLeave;
      return matchesCalendar && matchesJointLeave;
    })
    .map((holiday) => ({ ...holiday }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Checks whether a given date is a holiday (and optionally joint leave).
 */
export function isHoliday(
  date: Date | string,
  options: HolidayOptions = {}
): boolean {
  const dateStr = formatDateISO(date);
  const year = Number(dateStr.slice(0, 4));
  const holidays = getHolidays(year, options);
  return holidays.some((h) => h.date === dateStr);
}
