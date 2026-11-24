import {
  getAvailableYears,
  getHolidays,
  isHoliday,
  isWorkingDay,
} from '../src/index.js';
import type { CalendarType } from '../src/types.js';

const BASE_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'public, max-age=86400',
};

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: BASE_HEADERS,
  });
}

function parseBooleanParam(value: string | null, defaultValue: boolean): boolean {
  if (value === null) return defaultValue;
  const normalized = value.trim().toLowerCase();
  if (normalized === 'true' || normalized === '1') return true;
  if (normalized === 'false' || normalized === '0') return false;
  return defaultValue;
}

function parseCalendarParam(
  value: string | null
): { ok: true; value: CalendarType } | { ok: false; error: string } {
  if (value === null || value.trim() === '') {
    return { ok: true, value: 'skb' };
  }
  const normalized = value.trim().toLowerCase();
  if (normalized === 'skb' || normalized === 'muhammadiyah') {
    return { ok: true, value: normalized };
  }
  return {
    ok: false,
    error: `Invalid calendar parameter "${value}". Supported values: "skb", "muhammadiyah".`,
  };
}

export default {
  async fetch(request: Request): Promise<Response> {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: BASE_HEADERS });
    }

    if (request.method !== 'GET') {
      return jsonResponse({ error: 'Method Not Allowed' }, 405);
    }

    const url = new URL(request.url);
    const { pathname, searchParams } = url;

    if (pathname === '/' || pathname === '') {
      return jsonResponse({
        name: 'holiday-data API',
        version: '0.1.0',
        country: 'ID',
        availableYears: getAvailableYears('ID'),
        calendars: ['skb', 'muhammadiyah'],
        endpoints: [
          {
            method: 'GET',
            path: '/api/holidays',
            query: '?year=2026&includeJointLeave=true&calendar=skb',
            description: 'List public holidays and optional joint leave for a given year.',
          },
          {
            method: 'GET',
            path: '/api/is-holiday',
            query: '?date=2026-01-01&calendar=skb&includeJointLeave=true',
            description: 'Check whether a specific YYYY-MM-DD date is a holiday.',
          },
          {
            method: 'GET',
            path: '/api/is-working-day',
            query: '?date=2026-01-01&calendar=skb&includeJointLeave=true',
            description: 'Check whether a specific YYYY-MM-DD date is a working day.',
          },
        ],
      });
    }

    if (pathname === '/api/holidays') {
      const yearParam = searchParams.get('year');
      const year = yearParam ? Number(yearParam) : new Date().getUTCFullYear();
      if (!Number.isInteger(year) || year < 1900 || year > 2999) {
        return jsonResponse(
          { error: 'Invalid "year" query parameter. Expected a 4-digit year (e.g., 2026).' },
          400
        );
      }

      const cal = parseCalendarParam(searchParams.get('calendar'));
      if (!cal.ok) {
        return jsonResponse({ error: cal.error }, 400);
      }

      const includeJointLeave = parseBooleanParam(
        searchParams.get('includeJointLeave'),
        true
      );

      const holidays = getHolidays(year, {
        country: 'ID',
        calendar: cal.value,
        includeJointLeave,
      });

      return jsonResponse({
        year,
        country: 'ID',
        calendar: cal.value,
        includeJointLeave,
        count: holidays.length,
        holidays,
      });
    }

    if (pathname === '/api/is-holiday') {
      const date = searchParams.get('date');
      if (!date || !ISO_DATE_RE.test(date)) {
        return jsonResponse(
          { error: 'Missing or invalid "date" query parameter. Expected YYYY-MM-DD.' },
          400
        );
      }

      const cal = parseCalendarParam(searchParams.get('calendar'));
      if (!cal.ok) {
        return jsonResponse({ error: cal.error }, 400);
      }

      const includeJointLeave = parseBooleanParam(
        searchParams.get('includeJointLeave'),
        true
      );

      try {
        const options = {
          country: 'ID' as const,
          calendar: cal.value,
          includeJointLeave,
        };
        const matched = isHoliday(date, options);
        const year = Number(date.slice(0, 4));
        const holiday = matched
          ? getHolidays(year, options).find((h) => h.date === date) ?? null
          : null;

        return jsonResponse({
          date,
          country: 'ID',
          calendar: cal.value,
          includeJointLeave,
          isHoliday: matched,
          holiday,
        });
      } catch (err) {
        return jsonResponse(
          { error: err instanceof Error ? err.message : 'Invalid date' },
          400
        );
      }
    }

    if (pathname === '/api/is-working-day') {
      const date = searchParams.get('date');
      if (!date || !ISO_DATE_RE.test(date)) {
        return jsonResponse(
          { error: 'Missing or invalid "date" query parameter. Expected YYYY-MM-DD.' },
          400
        );
      }

      const cal = parseCalendarParam(searchParams.get('calendar'));
      if (!cal.ok) {
        return jsonResponse({ error: cal.error }, 400);
      }

      const includeJointLeave = parseBooleanParam(
        searchParams.get('includeJointLeave'),
        true
      );

      try {
        const workingDay = isWorkingDay(date, {
          country: 'ID',
          calendar: cal.value,
          includeJointLeave,
        });

        return jsonResponse({
          date,
          country: 'ID',
          calendar: cal.value,
          includeJointLeave,
          isWorkingDay: workingDay,
        });
      } catch (err) {
        return jsonResponse(
          { error: err instanceof Error ? err.message : 'Invalid date' },
          400
        );
      }
    }

    return jsonResponse(
      {
        error: 'Not Found',
        availableEndpoints: ['/', '/api/holidays', '/api/is-holiday', '/api/is-working-day'],
      },
      404
    );
  },
};
