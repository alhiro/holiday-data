import { describe, expect, it } from 'vitest';
import {
  countWorkingDays,
  getAvailableYears,
  getHolidays,
  getNextWorkingDay,
  isHoliday,
  isWorkingDay,
} from '../src/index.js';

describe('holiday-data core library', () => {
  it('returns available years', () => {
    expect(getAvailableYears()).toEqual([2025, 2026, 2027]);
  });

  it('returns empty array for unsupported years', () => {
    expect(getHolidays(2099)).toEqual([]);
  });

  it('filters joint leave with includeJointLeave option', () => {
    const all2026 = getHolidays(2026, { calendar: 'skb', includeJointLeave: true });
    const nationalOnly2026 = getHolidays(2026, {
      calendar: 'skb',
      includeJointLeave: false,
    });

    expect(all2026.length).toBeGreaterThan(nationalOnly2026.length);
    expect(nationalOnly2026.every((h) => !h.isJointLeave)).toBe(true);
    expect(all2026.some((h) => h.isJointLeave)).toBe(true);
  });

  it('distinguishes skb and muhammadiyah calendar variants in 2026', () => {
    // 2026-03-20: Joint leave in SKB, Eid al-Fitr (national holiday) in Muhammadiyah
    expect(
      isHoliday('2026-03-20', { calendar: 'skb', includeJointLeave: false })
    ).toBe(false);
    expect(
      isHoliday('2026-03-20', { calendar: 'skb', includeJointLeave: true })
    ).toBe(true);
    expect(
      isHoliday('2026-03-20', { calendar: 'muhammadiyah', includeJointLeave: false })
    ).toBe(true);

    // 2026-03-21: Eid al-Fitr in SKB, not listed as Muhammadiyah Eid
    expect(isHoliday('2026-03-21', { calendar: 'skb' })).toBe(true);
    expect(isHoliday('2026-03-21', { calendar: 'muhammadiyah' })).toBe(false);
  });

  it('checks isHoliday with both string and Date inputs', () => {
    expect(isHoliday('2026-01-01')).toBe(true);
    expect(isHoliday(new Date('2026-01-01T00:00:00Z'))).toBe(true);
    expect(isHoliday('2026-01-02')).toBe(false);
  });

  it('checks isWorkingDay accurately for weekdays, weekends, and holidays', () => {
    // 2026-01-01 is Thursday (New Year's Day)
    expect(isWorkingDay('2026-01-01')).toBe(false);
    // 2026-01-02 is Friday (regular working day)
    expect(isWorkingDay('2026-01-02')).toBe(true);
    // 2026-01-03 is Saturday (weekend)
    expect(isWorkingDay('2026-01-03')).toBe(false);
    // Custom weekend (Sunday only -> Saturday is a working day)
    expect(isWorkingDay('2026-01-03', { weekendDays: [0] })).toBe(true);
  });

  it('finds getNextWorkingDay skipping holidays and weekends', () => {
    // 2026-01-02 is Friday -> next working day is Monday 2026-01-05
    expect(getNextWorkingDay('2026-01-02')).toBe('2026-01-05');
    // 2026-03-17 is Tuesday; 18-24 March are Nyepi + Eid + Joint Leaves + Weekend
    // Next working day with SKB + joint leave is Wednesday 2026-03-25
    expect(getNextWorkingDay('2026-03-17')).toBe('2026-03-25');
  });

  it('counts working days accurately over a date range', () => {
    // 2026-01-01 (Thu, holiday), 02 (Fri, work), 03 (Sat), 04 (Sun), 05 (Mon, work)
    expect(countWorkingDays('2026-01-01', '2026-01-05')).toBe(2);
    // Reversed range returns 0
    expect(countWorkingDays('2026-01-05', '2026-01-01')).toBe(0);
    // Single working day
    expect(countWorkingDays('2026-01-02', '2026-01-02')).toBe(1);
  });
});
