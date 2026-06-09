export type Outcome = 'pass' | 'fail' | 'opaque' | 'timeout' | 'error' | 'pending';
export type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD';
export type BodyMode = 'regex' | 'contains';
export type FetchMode = 'auto' | 'cors' | 'no-cors';

export interface HttpCheck {
  id: string;
  kind: 'http';
  name: string;
  group?: string;
  enabled: boolean;
  method: Method;
  url: string;
  headers?: Record<string, string>;
  body?: string;
  /** Status matcher: "200", "2xx", "200-204" or a comma list of those. */
  expect: string;
  bodyMode?: BodyMode;
  bodyMatch?: string;
  mode?: FetchMode;
  timeoutMs?: number;
  slowMs?: number;
  /** Original curl text, when the check was authored that way. */
  curl?: string;
}

export interface JsCheck {
  id: string;
  kind: 'js';
  name: string;
  group?: string;
  enabled: boolean;
  source: string;
  timeoutMs?: number;
  slowMs?: number;
}

export type Check = HttpCheck | JsCheck;

export interface CheckResult {
  outcome: Outcome;
  status?: number;
  latencyMs?: number;
  sizeBytes?: number;
  message?: string;
  at: number;
}

export interface HistoryEntry {
  at: number;
  outcome: Outcome;
  latencyMs?: number;
}

export const DEFAULT_TIMEOUT_MS = 10_000;
export const DEFAULT_SLOW_MS = 1_000;
export const HISTORY_CAP = 50;

let idSeq = 0;
export function newId(): string {
  idSeq += 1;
  return `chk_${Date.now().toString(36)}_${idSeq.toString(36)}`;
}

/** Does an HTTP status satisfy an expectation spec like "2xx", "200" or "200-204,302"? */
export function matchStatus(expect: string, status: number): boolean {
  const spec = (expect || '2xx').trim().toLowerCase();
  return spec.split(',').some((raw) => {
    const part = raw.trim();
    if (/^[1-5]xx$/.test(part)) return Math.floor(status / 100) === Number(part[0]);
    if (/^\d{3}-\d{3}$/.test(part)) {
      const [a, b] = part.split('-').map(Number);
      return status >= a && status <= b;
    }
    if (/^\d{3}$/.test(part)) return status === Number(part);
    return false;
  });
}

/** Assert a response body. Regex mode may throw on an invalid pattern. */
export function assertBody(mode: BodyMode, pattern: string, body: string): boolean {
  if (mode === 'contains') return body.includes(pattern);
  return new RegExp(pattern).test(body);
}

/** Turn a concrete HTTP response into a pass/fail result with an explanatory message. */
export function evaluateHttp(
  check: HttpCheck,
  status: number,
  body: string,
  latencyMs: number,
): CheckResult {
  const statusOk = matchStatus(check.expect, status);
  let bodyOk = true;
  let bodyErr: string | undefined;
  if (check.bodyMatch) {
    try {
      bodyOk = assertBody(check.bodyMode ?? 'regex', check.bodyMatch, body);
    } catch {
      bodyOk = false;
      bodyErr = 'invalid body regex';
    }
  }
  const bits = [`HTTP ${status}`];
  if (!statusOk) bits.push(`expected ${check.expect}`);
  if (check.bodyMatch && !bodyOk) {
    bits.push(bodyErr ?? (check.bodyMode === 'contains' ? 'body text not found' : 'body regex no match'));
  }
  return {
    outcome: statusOk && bodyOk ? 'pass' : 'fail',
    status,
    latencyMs,
    sizeBytes: byteLength(body),
    at: Date.now(),
    message: bits.join(' · '),
  };
}

/** Byte length of a string (UTF-8), for reporting response size. */
export function byteLength(s: string): number {
  return typeof TextEncoder !== 'undefined' ? new TextEncoder().encode(s).length : s.length;
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} kB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

/** Roll up several outcomes into one: any failure dominates, else pending, else opaque, else pass. */
export function aggregateOutcome(outcomes: Outcome[]): Outcome {
  if (outcomes.length === 0) return 'pending';
  if (outcomes.some((o) => o === 'fail' || o === 'error' || o === 'timeout')) return 'fail';
  if (outcomes.some((o) => o === 'pending')) return 'pending';
  if (outcomes.some((o) => o === 'opaque')) return 'opaque';
  return 'pass';
}

export interface CheckGroup {
  name: string;
  checks: Check[];
}

/** Partition checks into groups by their `group` label, preserving array order. '' = ungrouped. */
export function groupChecks(checks: Check[]): CheckGroup[] {
  const order: string[] = [];
  const map = new Map<string, Check[]>();
  for (const c of checks) {
    const g = c.group || '';
    if (!map.has(g)) {
      map.set(g, []);
      order.push(g);
    }
    map.get(g)!.push(c);
  }
  return order.map((name) => ({ name, checks: map.get(name)! }));
}

/** Normalize whatever a user JS function returned into a CheckResult. */
export function normalizeJsResult(raw: unknown, latencyMs?: number): CheckResult {
  if (!raw || typeof raw !== 'object') {
    return {
      outcome: 'error',
      latencyMs,
      at: Date.now(),
      message: 'Function must return an object like { ok: boolean }',
    };
  }
  const r = raw as { ok?: unknown; status?: unknown; message?: unknown; latencyMs?: unknown };
  return {
    outcome: r.ok ? 'pass' : 'fail',
    status: typeof r.status === 'number' ? r.status : undefined,
    latencyMs: typeof r.latencyMs === 'number' ? r.latencyMs : latencyMs,
    at: Date.now(),
    message: typeof r.message === 'string' ? r.message : undefined,
  };
}

// ---------- curl parsing ----------

/** Split a curl command into argv, honoring quotes and backslash line-continuations. */
export function tokenizeCurl(input: string): string[] {
  const s = input.replace(/\\\r?\n/g, ' ').trim();
  const tokens: string[] = [];
  let i = 0;
  while (i < s.length) {
    while (i < s.length && /\s/.test(s[i])) i++;
    if (i >= s.length) break;
    let tok = '';
    while (i < s.length && !/\s/.test(s[i])) {
      const c = s[i];
      if (c === "'" || c === '"') {
        const quote = c;
        i++;
        while (i < s.length && s[i] !== quote) {
          if (s[i] === '\\' && quote === '"' && i + 1 < s.length) {
            i++;
            tok += s[i];
          } else {
            tok += s[i];
          }
          i++;
        }
        i++; // closing quote
      } else {
        tok += c;
        i++;
      }
    }
    tokens.push(tok);
  }
  return tokens;
}

const looksLikeUrl = (t: string) => /^https?:\/\//i.test(t) || /^[\w.-]+\.[a-z]{2,}/i.test(t);

export interface CurlParse {
  check: Partial<HttpCheck>;
  unsupported: string[];
  error?: string;
}

/** Parse a curl command into the fields of an HTTP check. */
export function parseCurl(text: string): CurlParse {
  const tokens = tokenizeCurl(text).filter((t, idx) => !(idx === 0 && t === 'curl'));
  const headers: Record<string, string> = {};
  const check: Partial<HttpCheck> = { method: 'GET', headers };
  const unsupported: string[] = [];
  let url = '';
  let bodySeen = false;
  const NOOP = new Set(['-L', '--location', '-s', '--silent', '-k', '--insecure', '-i', '--include', '-v', '--verbose', '--compressed', '-f', '--fail']);

  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (t === '-X' || t === '--request') {
      check.method = (tokens[++i] || 'GET').toUpperCase() as Method;
    } else if (t === '-H' || t === '--header') {
      const h = tokens[++i] || '';
      const idx = h.indexOf(':');
      if (idx > 0) headers[h.slice(0, idx).trim()] = h.slice(idx + 1).trim();
    } else if (t === '-d' || t === '--data' || t === '--data-raw' || t === '--data-binary' || t === '--data-ascii') {
      check.body = (check.body ? check.body + '&' : '') + (tokens[++i] || '');
      bodySeen = true;
    } else if (t === '-u' || t === '--user') {
      headers['Authorization'] = 'Basic ' + btoa(tokens[++i] || '');
    } else if (t === '-A' || t === '--user-agent') {
      headers['User-Agent'] = tokens[++i] || '';
    } else if (t === '--max-time' || t === '--connect-timeout') {
      const secs = Number(tokens[++i]);
      if (!Number.isNaN(secs)) check.timeoutMs = Math.round(secs * 1000);
    } else if (t === '--url') {
      url = tokens[++i] || '';
    } else if (NOOP.has(t)) {
      // accepted, no effect on the check
    } else if (t.startsWith('-')) {
      unsupported.push(t);
    } else if (!url && looksLikeUrl(t)) {
      url = t;
    } else if (!url) {
      url = t;
    }
  }

  if (bodySeen && check.method === 'GET') check.method = 'POST';
  if (Object.keys(headers).length === 0) delete check.headers;
  if (!url) return { check, unsupported, error: 'No URL found in the command.' };
  check.url = url.replace(/^https?:\/\//i, (m) => m.toLowerCase());
  return { check, unsupported };
}

// ---------- history ----------

/** Append an entry to a capped history ring (most recent last). */
export function pushHistory(list: HistoryEntry[] | undefined, entry: HistoryEntry, cap = HISTORY_CAP): HistoryEntry[] {
  const next = [...(list ?? []), entry];
  return next.length > cap ? next.slice(next.length - cap) : next;
}

export function successRatio(list: HistoryEntry[] | undefined): number {
  if (!list || list.length === 0) return 0;
  const passes = list.filter((e) => e.outcome === 'pass').length;
  return passes / list.length;
}

export interface Summary {
  pass: number;
  fail: number;
  other: number;
  total: number;
}

export function summarize(results: Record<string, CheckResult>, checks: Check[]): Summary {
  const enabled = checks.filter((c) => c.enabled);
  let pass = 0;
  let fail = 0;
  let other = 0;
  for (const c of enabled) {
    const o = results[c.id]?.outcome;
    if (o === 'pass') pass++;
    else if (o === 'fail' || o === 'error' || o === 'timeout') fail++;
    else other++;
  }
  return { pass, fail, other, total: enabled.length };
}
