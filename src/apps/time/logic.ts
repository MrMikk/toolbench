/** Parse a Unix timestamp (seconds or milliseconds) or an ISO/date string. */
export function parseInput(input: string): Date {
  const str = input.trim();
  if (!str) throw new Error('Enter a timestamp or date.');

  if (/^-?\d+$/.test(str)) {
    const num = Number(str);
    // Values below 1e11 are treated as seconds (year ~5138), above as milliseconds.
    const ms = Math.abs(num) < 1e11 ? num * 1000 : num;
    const date = new Date(ms);
    if (Number.isNaN(date.getTime())) throw new Error('Out-of-range timestamp.');
    return date;
  }

  const ms = Date.parse(str);
  if (Number.isNaN(ms)) throw new Error('Unrecognised date format.');
  return new Date(ms);
}

export const unixSeconds = (d: Date): number => Math.floor(d.getTime() / 1000);
export const unixMillis = (d: Date): number => d.getTime();
export const iso = (d: Date): string => d.toISOString();
export const local = (d: Date): string => d.toLocaleString();

export function relativeTime(target: Date, now = new Date()): string {
  const diff = target.getTime() - now.getTime();
  const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ['year', 31536e6],
    ['day', 864e5],
    ['hour', 36e5],
    ['minute', 6e4],
    ['second', 1e3],
  ];
  for (const [unit, ms] of units) {
    if (Math.abs(diff) >= ms || unit === 'second') return rtf.format(Math.round(diff / ms), unit);
  }
  return 'now';
}

export interface TimeRow {
  label: string;
  value: string;
}

/** All output representations of a date, in display order. */
export function describe(date: Date, now = new Date()): TimeRow[] {
  return [
    { label: 'Unix (seconds)', value: String(unixSeconds(date)) },
    { label: 'Unix (millis)', value: String(unixMillis(date)) },
    { label: 'ISO 8601 (UTC)', value: iso(date) },
    { label: 'Local', value: local(date) },
    { label: 'Relative', value: relativeTime(date, now) },
  ];
}
