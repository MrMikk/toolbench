export type Direction = 'auto' | 'json2csv' | 'csv2json';

function escapeCsv(value: unknown): string {
  const s = value == null ? '' : typeof value === 'object' ? JSON.stringify(value) : String(value);
  return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

/** Serialise an array of objects (or a single object) as RFC-4180 CSV. */
export function jsonToCsv(jsonText: string): string {
  let data: unknown;
  try {
    data = JSON.parse(jsonText);
  } catch {
    throw new Error('Input is not valid JSON.');
  }
  const arr = Array.isArray(data) ? data : [data];
  if (arr.length === 0) return '';

  const keys: string[] = [];
  const seen = new Set<string>();
  for (const item of arr) {
    if (item && typeof item === 'object' && !Array.isArray(item)) {
      for (const k of Object.keys(item)) {
        if (!seen.has(k)) {
          seen.add(k);
          keys.push(k);
        }
      }
    }
  }
  if (keys.length === 0) throw new Error('Expected an array of objects.');

  const lines = [keys.map(escapeCsv).join(',')];
  for (const item of arr) {
    const row = item as Record<string, unknown>;
    lines.push(keys.map((k) => escapeCsv(row?.[k])).join(','));
  }
  return lines.join('\n');
}

/** Parse CSV (with quoted fields, escaped quotes, CRLF) into rows of cells. */
export function parseCsv(text: string): string[][] {
  const s = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (inQuotes) {
      if (c === '"') {
        if (s[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ',') {
      row.push(field);
      field = '';
    } else if (c === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += c;
    }
  }
  row.push(field);
  rows.push(row);

  // Drop a trailing blank row produced by a final newline.
  if (rows.length && rows[rows.length - 1].length === 1 && rows[rows.length - 1][0] === '') {
    rows.pop();
  }
  return rows;
}

/** Convert CSV (with a header row) into pretty-printed JSON. */
export function csvToJson(csvText: string): string {
  const rows = parseCsv(csvText.trim());
  if (rows.length === 0) return '[]';
  const header = rows[0];
  const objects = rows.slice(1).map((r) => {
    const obj: Record<string, string> = {};
    header.forEach((key, idx) => {
      obj[key] = r[idx] ?? '';
    });
    return obj;
  });
  return JSON.stringify(objects, null, 2);
}

export function detect(input: string): 'json' | 'csv' {
  const t = input.trim();
  return t.startsWith('{') || t.startsWith('[') ? 'json' : 'csv';
}

export function convert(input: string, direction: Direction): string {
  const dir = direction === 'auto' ? (detect(input) === 'json' ? 'json2csv' : 'csv2json') : direction;
  return dir === 'json2csv' ? jsonToCsv(input) : csvToJson(input);
}
