export interface CronField {
  values: number[];
  raw: string;
}

export interface CronParts {
  minute: CronField;
  hour: CronField;
  dom: CronField;
  month: CronField;
  dow: CronField;
}

export const CRON_PRESETS: { expr: string; label: string }[] = [
  { expr: '* * * * *', label: 'Every minute' },
  { expr: '*/15 * * * *', label: 'Every 15 minutes' },
  { expr: '0 * * * *', label: 'Hourly' },
  { expr: '0 0 * * *', label: 'Daily at midnight' },
  { expr: '0 9 * * 1-5', label: 'Weekdays at 09:00' },
  { expr: '0 0 1 * *', label: 'Monthly' },
];

const ALIASES: Record<string, string> = {
  '@yearly': '0 0 1 1 *',
  '@annually': '0 0 1 1 *',
  '@monthly': '0 0 1 * *',
  '@weekly': '0 0 * * 0',
  '@daily': '0 0 * * *',
  '@midnight': '0 0 * * *',
  '@hourly': '0 * * * *',
};

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function parseField(raw: string, min: number, max: number): CronField {
  const values = new Set<number>();
  for (const part of raw.split(',')) {
    const [rangePart, stepPart] = part.split('/');
    const step = stepPart === undefined ? 1 : Number(stepPart);
    if (stepPart !== undefined && (!Number.isInteger(step) || step < 1)) {
      throw new Error(`Invalid step in "${raw}".`);
    }

    let lo: number;
    let hi: number;
    if (rangePart === '*') {
      lo = min;
      hi = max;
    } else if (rangePart.includes('-')) {
      const [a, b] = rangePart.split('-').map(Number);
      lo = a;
      hi = b;
    } else {
      lo = hi = Number(rangePart);
    }

    if (!Number.isInteger(lo) || !Number.isInteger(hi)) {
      throw new Error(`Invalid value in "${raw}".`);
    }
    if (lo < min || hi > max || lo > hi) {
      throw new Error(`"${raw}" is out of range ${min}-${max}.`);
    }
    for (let v = lo; v <= hi; v += step) values.add(v);
  }
  return { values: [...values].sort((a, b) => a - b), raw };
}

export function parseCron(expr: string): CronParts {
  const trimmed = expr.trim();
  const normalized = ALIASES[trimmed] ?? trimmed;
  const fields = normalized.split(/\s+/);
  if (fields.length !== 5) {
    throw new Error('Expected 5 fields: minute hour day-of-month month day-of-week.');
  }

  const dowRaw = parseField(fields[4], 0, 7);
  // Day-of-week 7 and 0 both mean Sunday.
  const dowValues = [...new Set(dowRaw.values.map((v) => (v === 7 ? 0 : v)))].sort((a, b) => a - b);

  return {
    minute: parseField(fields[0], 0, 59),
    hour: parseField(fields[1], 0, 23),
    dom: parseField(fields[2], 1, 31),
    month: parseField(fields[3], 1, 12),
    dow: { values: dowValues, raw: fields[4] },
  };
}

const isFull = (field: CronField, min: number, max: number) =>
  field.values.length === max - min + 1;

const pad = (n: number) => n.toString().padStart(2, '0');

export function describe(parts: CronParts): string {
  const { minute, hour, dom, month, dow } = parts;
  const chunks: string[] = [];

  if (isFull(minute, 0, 59) && isFull(hour, 0, 23)) {
    chunks.push('Every minute');
  } else if (minute.values.length === 1 && hour.values.length === 1) {
    chunks.push(`At ${pad(hour.values[0])}:${pad(minute.values[0])}`);
  } else {
    chunks.push(
      isFull(minute, 0, 59) ? 'Every minute' : `At minute ${minute.values.join(', ')}`,
    );
    if (!isFull(hour, 0, 23)) chunks.push(`past hour ${hour.values.join(', ')}`);
  }

  if (!isFull(dom, 1, 31)) chunks.push(`on day-of-month ${dom.values.join(', ')}`);
  if (!isFull(month, 1, 12)) chunks.push(`in ${month.values.map((m) => MONTHS[m - 1]).join(', ')}`);
  if (dow.values.length !== 7) chunks.push(`on ${dow.values.map((d) => DAYS[d]).join(', ')}`);

  return chunks.join(', ');
}

function matches(parts: CronParts, d: Date): boolean {
  if (!parts.minute.values.includes(d.getUTCMinutes())) return false;
  if (!parts.hour.values.includes(d.getUTCHours())) return false;
  if (!parts.month.values.includes(d.getUTCMonth() + 1)) return false;

  const domRestricted = !isFull(parts.dom, 1, 31);
  const dowRestricted = parts.dow.values.length !== 7;
  const domMatch = parts.dom.values.includes(d.getUTCDate());
  const dowMatch = parts.dow.values.includes(d.getUTCDay());

  // Cron's quirk: when both day fields are restricted, either may match.
  if (domRestricted && dowRestricted) return domMatch || dowMatch;
  if (domRestricted) return domMatch;
  if (dowRestricted) return dowMatch;
  return true;
}

/** The next `n` UTC run times strictly after `from`. */
export function nextRuns(parts: CronParts, from = new Date(), n = 5): Date[] {
  const out: Date[] = [];
  const d = new Date(from.getTime());
  d.setUTCSeconds(0, 0);
  d.setUTCMinutes(d.getUTCMinutes() + 1);

  // Bounded scan (~4 years of minutes) so an unsatisfiable expression can't hang.
  for (let guard = 0; out.length < n && guard < 366 * 24 * 60 * 4; guard++) {
    if (matches(parts, d)) out.push(new Date(d.getTime()));
    d.setUTCMinutes(d.getUTCMinutes() + 1);
  }
  return out;
}
