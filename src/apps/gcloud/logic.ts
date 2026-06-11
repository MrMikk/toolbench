// Pure, DOM-free, network-free helpers for the Cloud Monitor app. Everything that
// builds a request or parses a Google Cloud response lives here so it can be unit
// tested without a browser or a live token. The side-effectful parts (the GSI
// token client and the fetch layer) live in auth.ts and api.ts.

export type ResourceKind = 'run' | 'sql';
export type TimeRangeId = '1h' | '6h' | '24h' | '7d';
export type ScopeMode = 'narrow' | 'broad';

export interface TimeInterval {
  startTime: string; // RFC3339
  endTime: string; // RFC3339
}

export interface RunService {
  name: string;
  region: string;
  uri?: string;
  updateTime?: string;
}

export interface SqlInstance {
  name: string;
  region: string;
  databaseVersion?: string;
  tier?: string;
  state?: string;
}

export interface SeriesPoint {
  t: number; // epoch ms
  v: number;
}

export interface MetricSeries {
  metricType: string;
  label: string;
  points: SeriesPoint[];
}

export interface LogRow {
  timestamp: string;
  severity: string;
  text: string;
}

export type MetricUnit = 'percent' | 'ms' | 'rate' | 'count';

export interface MetricDef {
  type: string;
  label: string;
  aligner: string;
  unit: MetricUnit;
}

export type ApiErrorKind = 'auth' | 'scope' | 'cors' | 'notEnabled' | 'http' | 'network';

export interface ApiErrorInfo {
  kind: ApiErrorKind;
  message: string;
  status?: number;
}

export interface TokenState {
  accessToken: string;
  expiresAt: number; // epoch ms
}

// ---------- OAuth scopes ----------
const MONITORING_READ = 'https://www.googleapis.com/auth/monitoring.read';
const LOGGING_READ = 'https://www.googleapis.com/auth/logging.read';
const CLOUD_PLATFORM_RO = 'https://www.googleapis.com/auth/cloud-platform.read-only';
const SQLSERVICE_ADMIN = 'https://www.googleapis.com/auth/sqlservice.admin';
const CLOUD_PLATFORM = 'https://www.googleapis.com/auth/cloud-platform';

/**
 * OAuth scopes. 'narrow' requests the least-privilege scope each API accepts:
 * monitoring.read + logging.read for metrics/logs, cloud-platform.read-only for
 * Cloud Run inventory, and sqlservice.admin for Cloud SQL — whose instances.list
 * does NOT accept cloud-platform.read-only (only cloud-platform or
 * sqlservice.admin). 'broad' is the single full-access superset, the fallback
 * when an API still reports an insufficient scope. (Reads are gated by IAM
 * regardless of the OAuth scope.)
 */
export function scopesFor(mode: ScopeMode): string[] {
  return mode === 'broad'
    ? [CLOUD_PLATFORM]
    : [MONITORING_READ, LOGGING_READ, CLOUD_PLATFORM_RO, SQLSERVICE_ADMIN];
}

export function isExpired(state: TokenState, skewMs = 60_000): boolean {
  return Date.now() >= state.expiresAt - skewMs;
}

// ---------- Time ranges ----------
const RANGE_SECONDS: Record<TimeRangeId, number> = {
  '1h': 3600,
  '6h': 21600,
  '24h': 86400,
  '7d': 604800,
};

export const TIME_RANGES: { id: TimeRangeId; label: string }[] = [
  { id: '1h', label: 'Last 1 hour' },
  { id: '6h', label: 'Last 6 hours' },
  { id: '24h', label: 'Last 24 hours' },
  { id: '7d', label: 'Last 7 days' },
];

export function timeRangeToInterval(range: TimeRangeId, now: number): TimeInterval {
  const end = Math.floor(now / 1000) * 1000;
  const start = end - RANGE_SECONDS[range] * 1000;
  return { startTime: new Date(start).toISOString(), endTime: new Date(end).toISOString() };
}

/** Coarser alignment for longer ranges keeps the returned point count bounded. */
export function alignmentPeriodFor(range: TimeRangeId): string {
  switch (range) {
    case '1h':
      return '60s';
    case '6h':
      return '300s';
    case '24h':
      return '900s';
    case '7d':
      return '3600s';
  }
}

// ---------- Metric catalog ----------
export const METRICS: Record<ResourceKind, MetricDef[]> = {
  run: [
    { type: 'run.googleapis.com/request_count', label: 'Requests', aligner: 'ALIGN_RATE', unit: 'rate' },
    { type: 'run.googleapis.com/request_latencies', label: 'Latency p99', aligner: 'ALIGN_PERCENTILE_99', unit: 'ms' },
    { type: 'run.googleapis.com/container/cpu/utilizations', label: 'CPU', aligner: 'ALIGN_PERCENTILE_99', unit: 'percent' },
    { type: 'run.googleapis.com/container/memory/utilizations', label: 'Memory', aligner: 'ALIGN_PERCENTILE_99', unit: 'percent' },
    { type: 'run.googleapis.com/container/instance_count', label: 'Instances', aligner: 'ALIGN_MEAN', unit: 'count' },
  ],
  sql: [
    { type: 'cloudsql.googleapis.com/database/cpu/utilization', label: 'CPU', aligner: 'ALIGN_MEAN', unit: 'percent' },
    { type: 'cloudsql.googleapis.com/database/memory/utilization', label: 'Memory', aligner: 'ALIGN_MEAN', unit: 'percent' },
    { type: 'cloudsql.googleapis.com/database/disk/utilization', label: 'Disk', aligner: 'ALIGN_MEAN', unit: 'percent' },
    { type: 'cloudsql.googleapis.com/database/network/connections', label: 'Connections', aligner: 'ALIGN_MEAN', unit: 'count' },
  ],
};

// ---------- Monitoring queries ----------
/** Quote and escape a Monitoring/Logging filter literal. */
function q(value: string): string {
  return '"' + value.replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"';
}

/**
 * Build a Monitoring filter. For 'run' the resourceId is the service name; for
 * 'sql' it is the database_id label, i.e. `<project>:<instance>`.
 */
export function buildMonitoringFilter(
  metricType: string,
  kind: ResourceKind,
  resourceId: string,
): string {
  if (kind === 'run') {
    return `metric.type=${q(metricType)} AND resource.type="cloud_run_revision" AND resource.labels.service_name=${q(resourceId)}`;
  }
  return `metric.type=${q(metricType)} AND resource.type="cloudsql_database" AND resource.labels.database_id=${q(resourceId)}`;
}

export function monitoringQueryParams(
  filter: string,
  interval: TimeInterval,
  alignmentPeriod: string,
  aligner: string,
): URLSearchParams {
  const params = new URLSearchParams();
  params.set('filter', filter);
  params.set('interval.startTime', interval.startTime);
  params.set('interval.endTime', interval.endTime);
  params.set('aggregation.alignmentPeriod', alignmentPeriod);
  params.set('aggregation.perSeriesAligner', aligner);
  return params;
}

interface RawPoint {
  interval?: { endTime?: string };
  value?: {
    doubleValue?: number;
    int64Value?: string | number;
    distributionValue?: { mean?: number };
    boolValue?: boolean;
  };
}

function pointValue(p: RawPoint): number | null {
  const v = p.value;
  if (!v) return null;
  if (typeof v.doubleValue === 'number') return v.doubleValue;
  if (v.int64Value != null) return Number(v.int64Value);
  if (v.distributionValue && typeof v.distributionValue.mean === 'number') return v.distributionValue.mean;
  if (typeof v.boolValue === 'boolean') return v.boolValue ? 1 : 0;
  return null;
}

/** Parse a Monitoring timeSeries response into ascending, sparkline-ready series. */
export function parseTimeSeries(json: unknown): MetricSeries[] {
  const list = (json as { timeSeries?: unknown })?.timeSeries;
  if (!Array.isArray(list)) return [];
  const out: MetricSeries[] = [];
  for (const ts of list) {
    const series = ts as { metric?: { type?: string }; points?: RawPoint[] };
    const points: SeriesPoint[] = [];
    for (const p of series.points ?? []) {
      const v = pointValue(p);
      const t = Date.parse(p.interval?.endTime ?? '');
      if (v != null && !Number.isNaN(t)) points.push({ t, v });
    }
    points.sort((a, b) => a.t - b.t);
    out.push({ metricType: series.metric?.type ?? '', label: series.metric?.type ?? '', points });
  }
  return out;
}

export function latestValue(series: MetricSeries): number | undefined {
  return series.points.length ? series.points[series.points.length - 1].v : undefined;
}

export function seriesMinMax(series: MetricSeries): { min: number; max: number } {
  if (!series.points.length) return { min: 0, max: 0 };
  let min = Infinity;
  let max = -Infinity;
  for (const p of series.points) {
    if (p.v < min) min = p.v;
    if (p.v > max) max = p.v;
  }
  return { min, max };
}

/** A pure SVG path string for a sparkline across `width` x `height`. */
export function sparklinePath(points: SeriesPoint[], width: number, height: number): string {
  if (!points.length) return '';
  if (points.length === 1) {
    const y = (height / 2).toFixed(1);
    return `M0 ${y} L${width} ${y}`;
  }
  let min = Infinity;
  let max = -Infinity;
  for (const p of points) {
    if (p.v < min) min = p.v;
    if (p.v > max) max = p.v;
  }
  const span = max - min || 1;
  const stepX = width / (points.length - 1);
  return points
    .map((p, i) => {
      const x = (i * stepX).toFixed(1);
      // Invert: higher values sit nearer the top.
      const y = (height - ((p.v - min) / span) * height).toFixed(1);
      return `${i === 0 ? 'M' : 'L'}${x} ${y}`;
    })
    .join(' ');
}

// ---------- Logging ----------
export function buildLoggingFilter(
  kind: ResourceKind,
  resourceId: string,
  opts: { severity?: string; sinceRfc3339?: string } = {},
): string {
  const parts =
    kind === 'run'
      ? [`resource.type="cloud_run_revision"`, `resource.labels.service_name=${q(resourceId)}`]
      : [`resource.type="cloudsql_database"`, `resource.labels.database_id=${q(resourceId)}`];
  if (opts.severity && opts.severity !== 'DEFAULT') parts.push(`severity>=${opts.severity}`);
  if (opts.sinceRfc3339) parts.push(`timestamp>=${q(opts.sinceRfc3339)}`);
  return parts.join(' AND ');
}

export function loggingRequestBody(
  projectId: string,
  filter: string,
  pageSize: number,
): { resourceNames: string[]; filter: string; pageSize: number; orderBy: string } {
  return {
    resourceNames: [`projects/${projectId}`],
    filter,
    pageSize,
    orderBy: 'timestamp desc',
  };
}

export function parseLogEntries(json: unknown): LogRow[] {
  const list = (json as { entries?: unknown })?.entries;
  if (!Array.isArray(list)) return [];
  return list.map((raw) => {
    const e = raw as {
      timestamp?: string;
      severity?: string;
      textPayload?: string;
      jsonPayload?: unknown;
      protoPayload?: { message?: string } & Record<string, unknown>;
    };
    let text = '';
    if (typeof e.textPayload === 'string') text = e.textPayload;
    else if (e.jsonPayload != null) text = JSON.stringify(e.jsonPayload);
    else if (e.protoPayload != null)
      text = typeof e.protoPayload.message === 'string' ? e.protoPayload.message : JSON.stringify(e.protoPayload);
    return { timestamp: e.timestamp ?? '', severity: e.severity ?? 'DEFAULT', text };
  });
}

// ---------- Inventory ----------
/** Pull the trailing segment after `/<segment>/` from a resource path. */
function pathSegment(name: string, segment: string): string {
  const m = name.match(new RegExp(`/${segment}/([^/]+)`));
  return m ? m[1] : '';
}

export function parseRunServices(json: unknown): RunService[] {
  const list = (json as { services?: unknown })?.services;
  if (!Array.isArray(list)) return [];
  return list.map((raw) => {
    const s = raw as { name?: string; uri?: string; updateTime?: string };
    const name = s.name ?? '';
    return {
      name: pathSegment(name, 'services') || name,
      region: pathSegment(name, 'locations'),
      uri: s.uri,
      updateTime: s.updateTime,
    };
  });
}

export function parseSqlInstances(json: unknown): SqlInstance[] {
  const list = (json as { items?: unknown })?.items;
  if (!Array.isArray(list)) return [];
  return list.map((raw) => {
    const i = raw as {
      name?: string;
      region?: string;
      databaseVersion?: string;
      state?: string;
      settings?: { tier?: string };
    };
    return {
      name: i.name ?? '',
      region: i.region ?? '',
      databaseVersion: i.databaseVersion,
      tier: i.settings?.tier,
      state: i.state,
    };
  });
}

// ---------- Formatting ----------
export function formatMetricValue(v: number, unit: MetricUnit): string {
  switch (unit) {
    case 'percent':
      return `${(v * 100).toFixed(v * 100 < 10 ? 1 : 0)}%`;
    case 'ms':
      return `${v.toFixed(v < 10 ? 1 : 0)} ms`;
    case 'rate':
      return `${v.toFixed(2)}/s`;
    case 'count':
      return v >= 1000 ? `${(v / 1000).toFixed(1)}k` : `${Math.round(v)}`;
  }
}

export function relativeTime(rfc3339: string, now: number): string {
  const t = Date.parse(rfc3339);
  if (Number.isNaN(t)) return '';
  const sec = Math.round((now - t) / 1000);
  if (sec < 5) return 'just now';
  if (sec < 60) return `${sec}s ago`;
  const min = Math.round(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  return `${Math.round(hr / 24)}d ago`;
}

// ---------- Error mapping ----------
interface RawApiError {
  error?: {
    status?: string;
    message?: string;
    errors?: { reason?: string }[];
  };
}

/** Map an HTTP status + Google error body to an actionable ApiErrorInfo. */
export function mapApiError(status: number, body: unknown): ApiErrorInfo {
  const err = (body as RawApiError)?.error;
  const message = err?.message || `Request failed (HTTP ${status}).`;
  if (status === 401) {
    return { kind: 'auth', status, message: 'Access token expired or invalid — reconnect to continue.' };
  }
  if (status === 403) {
    const reason = (err?.errors?.[0]?.reason || err?.status || '') + ' ' + message;
    if (/SERVICE_DISABLED|accessNotConfigured|has not been used|is disabled/i.test(reason)) {
      return { kind: 'notEnabled', status, message };
    }
    if (/scope|insufficient|permission|ACCESS_TOKEN_SCOPE/i.test(reason)) {
      return {
        kind: 'scope',
        status,
        message: message + ' Try signing out and reconnecting with the Broad scope.',
      };
    }
    return { kind: 'http', status, message };
  }
  if (status === 429) {
    return { kind: 'http', status, message: 'Rate limited by Google Cloud — slow down and retry.' };
  }
  return { kind: 'http', status, message };
}
