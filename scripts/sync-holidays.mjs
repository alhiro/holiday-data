#!/usr/bin/env node
/**
 * Zero-dependency holiday sync script (Node.js 20+).
 * Fetches Indonesian public holidays and joint leave from Google Calendar ICS
 * and updates data/id/<year>.json while preserving manual "muhammadiyah" entries.
 */

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ICS_URL =
  'https://calendar.google.com/calendar/ical/id.indonesian%23holiday%40group.v.calendar.google.com/public/basic.ics';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.resolve(__dirname, '../data/id');

const ENGLISH_NAME_PATTERNS = [
  [/tahun baru.*masehi|new year/i, "New Year's Day"],
  [/isra\s*mi'?raj/i, "Isra and Mi'raj"],
  [/cuti bersama.*imlek/i, 'Chinese New Year Joint Leave'],
  [/imlek/i, 'Chinese New Year'],
  [/cuti bersama.*nyepi/i, 'Nyepi Joint Leave'],
  [/nyepi/i, 'Day of Silence (Nyepi)'],
  [/cuti bersama.*idul\s*fitri/i, 'Eid al-Fitr Joint Leave'],
  [/idul\s*fitri/i, 'Eid al-Fitr'],
  [/cuti bersama.*wafat/i, 'Good Friday Joint Leave'],
  [/wafat yesus|jumat agung/i, 'Good Friday'],
  [/paskah|kebangkitan yesus/i, 'Easter Sunday'],
  [/hari buruh/i, "International Workers' Day"],
  [/cuti bersama.*kenaikan/i, 'Ascension of Jesus Christ Joint Leave'],
  [/kenaikan yesus|kenaikan isa/i, 'Ascension of Jesus Christ'],
  [/cuti bersama.*waisak/i, 'Vesak Day Joint Leave'],
  [/waisak/i, 'Vesak Day'],
  [/pancasila/i, 'Pancasila Day'],
  [/cuti bersama.*idul\s*adha/i, 'Eid al-Adha Joint Leave'],
  [/idul\s*adha/i, 'Eid al-Adha'],
  [/tahun baru islam/i, 'Islamic New Year'],
  [/kemerdekaan/i, 'Independence Day'],
  [/maulid/i, "Mawlid (Prophet Muhammad's Birthday)"],
  [/cuti bersama.*natal/i, 'Christmas Joint Leave'],
  [/natal|kelahiran yesus/i, 'Christmas Day'],
];

function inferEnglishName(localName) {
  for (const [pattern, english] of ENGLISH_NAME_PATTERNS) {
    if (pattern.test(localName)) {
      return english;
    }
  }
  return localName;
}

function unescapeICS(value) {
  return value
    .replace(/\\n/gi, ' ')
    .replace(/\\,/g, ',')
    .replace(/\\;/g, ';')
    .replace(/\\\\/g, '\\')
    .trim();
}

function parseICS(icsText) {
  // Unfold folded lines per RFC 5545
  const unfolded = icsText.replace(/\r?\n[ \t]/g, '');
  const lines = unfolded.split(/\r?\n/);

  const events = [];
  let current = null;

  for (const line of lines) {
    if (line === 'BEGIN:VEVENT') {
      current = {};
      continue;
    }
    if (line === 'END:VEVENT') {
      if (current && current.date && current.summary) {
        events.push(current);
      }
      current = null;
      continue;
    }
    if (!current) continue;

    if (line.startsWith('DTSTART')) {
      const value = line.split(':').slice(1).join(':').trim();
      const match = /^(\d{4})(\d{2})(\d{2})/.exec(value);
      if (match) {
        current.date = `${match[1]}-${match[2]}-${match[3]}`;
      }
    } else if (line.startsWith('SUMMARY')) {
      current.summary = unescapeICS(line.split(':').slice(1).join(':'));
    } else if (line.startsWith('DESCRIPTION')) {
      current.description = unescapeICS(line.split(':').slice(1).join(':'));
    }
  }

  return events;
}

function isOfficialHolidayEvent(event) {
  const desc = (event.description || '').toLowerCase();
  const summary = (event.summary || '').toLowerCase();

  // Exclude non-holiday observances
  if (desc.includes('observance') || desc.includes('hari peringatan')) {
    return false;
  }

  // Keep joint leave and official public holidays
  if (summary.includes('cuti bersama') || desc.includes('cuti bersama')) {
    return true;
  }
  if (
    desc.includes('public holiday') ||
    desc.includes('hari libur nasional') ||
    desc.includes('libur nasional') ||
    desc === ''
  ) {
    return true;
  }

  return false;
}

async function readExistingFile(filePath) {
  try {
    const raw = await readFile(filePath, 'utf8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function main() {
  const nowYear = new Date().getUTCFullYear();
  const cliYears = process.argv
    .slice(2)
    .map(Number)
    .filter((y) => Number.isInteger(y) && y >= 2000 && y <= 2100);
  const targetYears = cliYears.length > 0 ? cliYears : [nowYear, nowYear + 1];

  console.log(`Fetching Indonesian holidays from Google Calendar ICS...`);
  const response = await fetch(ICS_URL);
  if (!response.ok) {
    throw new Error(`Failed to fetch ICS (${response.status} ${response.statusText})`);
  }

  const icsText = await response.text();
  const allEvents = parseICS(icsText).filter(isOfficialHolidayEvent);

  await mkdir(DATA_DIR, { recursive: true });

  for (const year of targetYears) {
    const yearPrefix = `${year}-`;
    const filePath = path.join(DATA_DIR, `${year}.json`);
    const existing = await readExistingFile(filePath);

    // Preserve manual Muhammadiyah entries (and any SKB-specific entries on dates that have a Muhammadiyah override)
    const preservedMuhammadiyah = existing.filter(
      (item) => item.calendar === 'muhammadiyah'
    );
    const existingByDateAndCal = new Map(
      existing.map((item) => [`${item.date}::${item.calendar ?? 'all'}`, item])
    );
    const muhammadiyahDates = new Set(preservedMuhammadiyah.map((item) => item.date));

    const fetchedForYear = allEvents.filter((ev) => ev.date.startsWith(yearPrefix));
    if (fetchedForYear.length === 0) {
      console.log(`No ICS events found for ${year}; skipping write to preserve existing data.`);
      continue;
    }

    const mergedMap = new Map();

    // Add fetched entries
    for (const ev of fetchedForYear) {
      const localName = ev.summary;
      const isJointLeave = /cuti\s+bersama|joint\s+leave/i.test(localName);
      const calendar = muhammadiyahDates.has(ev.date) ? 'skb' : 'all';
      const existingMatch =
        existingByDateAndCal.get(`${ev.date}::${calendar}`) ||
        existingByDateAndCal.get(`${ev.date}::all`);

      const entry = {
        date: ev.date,
        name: existingMatch?.name ?? inferEnglishName(localName),
        localName,
        isJointLeave,
        calendar,
      };
      mergedMap.set(`${entry.date}::${entry.calendar}`, entry);
    }

    // Re-insert preserved Muhammadiyah entries so they are never overwritten
    for (const manualEntry of preservedMuhammadiyah) {
      mergedMap.set(`${manualEntry.date}::muhammadiyah`, manualEntry);
    }

    const sorted = Array.from(mergedMap.values()).sort((a, b) => {
      const dateCmp = a.date.localeCompare(b.date);
      if (dateCmp !== 0) return dateCmp;
      return (a.calendar ?? 'all').localeCompare(b.calendar ?? 'all');
    });

    await writeFile(filePath, `${JSON.stringify(sorted, null, 2)}\n`, 'utf8');
    console.log(
      `Updated data/id/${year}.json (${sorted.length} entries, ${preservedMuhammadiyah.length} Muhammadiyah entries preserved).`
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
