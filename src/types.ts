export type CalendarType = 'skb' | 'muhammadiyah';

export type CountryCode = 'ID';

export interface Holiday {
  /** ISO 8601 date string in YYYY-MM-DD format */
  date: string;
  /** English name of the holiday */
  name: string;
  /** Local Indonesian name of the holiday */
  localName: string;
  /** Whether this date is a collective leave (Cuti Bersama) */
  isJointLeave: boolean;
  /** Calendar variant applicability. Defaults to 'all' when omitted */
  calendar?: 'all' | CalendarType;
}

export interface HolidayOptions {
  /** ISO 3166-1 alpha-2 country code. Default: 'ID' */
  country?: CountryCode;
  /** Calendar variant filter. Default: 'skb' */
  calendar?: CalendarType;
  /** Whether to include collective leave (Cuti Bersama). Default: true */
  includeJointLeave?: boolean;
  /** Days of the week considered weekends (0 = Sunday, 6 = Saturday). Default: [0, 6] */
  weekendDays?: number[];
}
