import { describe, it, expect } from 'vitest';
import {
  alignmentPeriodFor,
  buildLoggingFilter,
  buildMonitoringFilter,
  formatMetricValue,
  isExpired,
  latestValue,
  loggingRequestBody,
  mapApiError,
  monitoringQueryParams,
  parseLogEntries,
  parseRunServices,
  parseSqlInstances,
  parseTimeSeries,
  relativeTime,
  scopesFor,
  seriesMinMax,
  sparklinePath,
  timeRangeToInterval,
} from '../src/apps/gcloud/logic';
import { ApiError, listSqlInstances } from '../src/apps/gcloud/api';

describe('gcloud: time ranges & scopes', () => {
  it('builds RFC3339 intervals of the right length', () => {
    const now = Date.parse('2026-06-11T08:00:00.000Z');
    const i = timeRangeToInterval('1h', now);
    expect(i.endTime).toBe('2026-06-11T08:00:00.000Z');
    expect(i.startTime).toBe('2026-06-11T07:00:00.000Z');
    expect(Date.parse(timeRangeToInterval('7d', now).startTime)).toBe(now - 7 * 86400_000);
  });

  it('uses coarser alignment for longer ranges', () => {
    expect(alignmentPeriodFor('1h')).toBe('60s');
    expect(alignmentPeriodFor('7d')).toBe('3600s');
  });

  it('narrow names each API scope (incl. a SQL-capable scope); broad is full cloud-platform', () => {
    // Cloud SQL instances.list rejects cloud-platform.read-only, so narrow must
    // carry sqlservice.admin or SQL inventory fails with "insufficient scopes".
    const narrow = scopesFor('narrow');
    expect(narrow).toContain('https://www.googleapis.com/auth/monitoring.read');
    expect(narrow).toContain('https://www.googleapis.com/auth/logging.read');
    expect(narrow).toContain('https://www.googleapis.com/auth/cloud-platform.read-only');
    expect(narrow).toContain('https://www.googleapis.com/auth/sqlservice.admin');
    // Broad must be a true superset so escalating to it actually fixes a scope error.
    expect(scopesFor('broad')).toEqual(['https://www.googleapis.com/auth/cloud-platform']);
  });

  it('isExpired respects the skew window', () => {
    expect(isExpired({ accessToken: 'x', expiresAt: Date.now() + 10_000 })).toBe(true); // within skew
    expect(isExpired({ accessToken: 'x', expiresAt: Date.now() + 120_000 })).toBe(false);
  });
});

describe('gcloud: monitoring filters & query params', () => {
  it('builds run and sql filters with the right resource type', () => {
    const run = buildMonitoringFilter('run.googleapis.com/request_count', 'run', 'api');
    expect(run).toContain('metric.type="run.googleapis.com/request_count"');
    expect(run).toContain('resource.type="cloud_run_revision"');
    expect(run).toContain('resource.labels.service_name="api"');

    const sql = buildMonitoringFilter('cloudsql.googleapis.com/database/cpu/utilization', 'sql', 'proj:db');
    expect(sql).toContain('resource.type="cloudsql_database"');
    expect(sql).toContain('resource.labels.database_id="proj:db"');
  });

  it('encodes monitoring query params', () => {
    const p = monitoringQueryParams(
      'metric.type="x"',
      { startTime: 'A', endTime: 'B' },
      '60s',
      'ALIGN_RATE',
    );
    expect(p.get('filter')).toBe('metric.type="x"');
    expect(p.get('interval.startTime')).toBe('A');
    expect(p.get('aggregation.alignmentPeriod')).toBe('60s');
    expect(p.get('aggregation.perSeriesAligner')).toBe('ALIGN_RATE');
  });
});

describe('gcloud: timeSeries parsing & sparkline', () => {
  const sample = {
    timeSeries: [
      {
        metric: { type: 'run.googleapis.com/request_count' },
        points: [
          { interval: { endTime: '2026-06-11T08:02:00Z' }, value: { doubleValue: 3 } },
          { interval: { endTime: '2026-06-11T08:00:00Z' }, value: { int64Value: '1' } },
          { interval: { endTime: '2026-06-11T08:01:00Z' }, value: { distributionValue: { mean: 2 } } },
        ],
      },
    ],
  };

  it('parses values and sorts ascending by time', () => {
    const series = parseTimeSeries(sample);
    expect(series).toHaveLength(1);
    expect(series[0].points.map((p) => p.v)).toEqual([1, 2, 3]);
    expect(latestValue(series[0])).toBe(3);
    expect(seriesMinMax(series[0])).toEqual({ min: 1, max: 3 });
  });

  it('tolerates empty / malformed input', () => {
    expect(parseTimeSeries(null)).toEqual([]);
    expect(parseTimeSeries({ timeSeries: [] })).toEqual([]);
    expect(latestValue({ metricType: '', label: '', points: [] })).toBeUndefined();
    expect(seriesMinMax({ metricType: '', label: '', points: [] })).toEqual({ min: 0, max: 0 });
  });

  it('produces an SVG path, with edge cases handled', () => {
    expect(sparklinePath([], 120, 32)).toBe('');
    expect(sparklinePath([{ t: 1, v: 5 }], 120, 32)).toBe('M0 16.0 L120 16.0');
    const path = sparklinePath(
      [
        { t: 1, v: 0 },
        { t: 2, v: 10 },
      ],
      100,
      40,
    );
    expect(path.startsWith('M0.0 40.0')).toBe(true);
    expect(path).toContain('L100.0 0.0');
  });
});

describe('gcloud: logging', () => {
  it('builds filters with severity and time bound', () => {
    const f = buildLoggingFilter('run', 'api', { severity: 'ERROR', sinceRfc3339: '2026-06-11T08:00:00Z' });
    expect(f).toContain('resource.type="cloud_run_revision"');
    expect(f).toContain('resource.labels.service_name="api"');
    expect(f).toContain('severity>=ERROR');
    expect(f).toContain('timestamp>="2026-06-11T08:00:00Z"');
  });

  it('omits the default severity', () => {
    expect(buildLoggingFilter('sql', 'p:db', { severity: 'DEFAULT' })).not.toContain('severity');
  });

  it('builds a request body and parses entries', () => {
    expect(loggingRequestBody('proj', 'f', 50)).toEqual({
      resourceNames: ['projects/proj'],
      filter: 'f',
      pageSize: 50,
      orderBy: 'timestamp desc',
    });
    const rows = parseLogEntries({
      entries: [
        { timestamp: 't1', severity: 'INFO', textPayload: 'hello' },
        { timestamp: 't2', jsonPayload: { a: 1 } },
      ],
    });
    expect(rows[0]).toEqual({ timestamp: 't1', severity: 'INFO', text: 'hello' });
    expect(rows[1].severity).toBe('DEFAULT');
    expect(rows[1].text).toBe('{"a":1}');
  });
});

describe('gcloud: inventory parsing', () => {
  it('parses run services (name + region from path)', () => {
    const svc = parseRunServices({
      services: [{ name: 'projects/p/locations/us-central1/services/api', uri: 'https://api.run.app' }],
    });
    expect(svc[0]).toMatchObject({ name: 'api', region: 'us-central1', uri: 'https://api.run.app' });
    expect(parseRunServices({})).toEqual([]);
  });

  it('parses sql instances', () => {
    const inst = parseSqlInstances({
      items: [{ name: 'db1', region: 'us-central1', databaseVersion: 'POSTGRES_15', settings: { tier: 'db-custom-1' }, state: 'RUNNABLE' }],
    });
    expect(inst[0]).toEqual({
      name: 'db1',
      region: 'us-central1',
      databaseVersion: 'POSTGRES_15',
      tier: 'db-custom-1',
      state: 'RUNNABLE',
    });
  });
});

describe('gcloud: formatting & error mapping', () => {
  it('formats metric values by unit', () => {
    expect(formatMetricValue(0.42, 'percent')).toBe('42%');
    expect(formatMetricValue(0.05, 'percent')).toBe('5.0%');
    expect(formatMetricValue(123.4, 'ms')).toBe('123 ms');
    expect(formatMetricValue(2.5, 'rate')).toBe('2.50/s');
    expect(formatMetricValue(1500, 'count')).toBe('1.5k');
  });

  it('formats relative time', () => {
    const now = Date.parse('2026-06-11T08:00:00Z');
    expect(relativeTime('2026-06-11T07:58:00Z', now)).toBe('2m ago');
    expect(relativeTime('2026-06-11T08:00:00Z', now)).toBe('just now');
    expect(relativeTime('bad', now)).toBe('');
  });

  it('maps HTTP statuses to actionable error kinds', () => {
    expect(mapApiError(401, {}).kind).toBe('auth');
    expect(mapApiError(403, { error: { message: 'Cloud Run Admin API has not been used' } }).kind).toBe('notEnabled');
    expect(mapApiError(403, { error: { message: 'insufficient authentication scopes' } }).kind).toBe('scope');
    expect(mapApiError(500, { error: { message: 'boom' } })).toMatchObject({ kind: 'http', message: 'boom' });
  });
});

describe('gcloud: api fetch layer (mocked fetch)', () => {
  const ok = (json: unknown): typeof fetch =>
    (async () => new Response(JSON.stringify(json), { status: 200 })) as unknown as typeof fetch;
  const fail = (status: number, body: unknown): typeof fetch =>
    (async () => new Response(JSON.stringify(body), { status })) as unknown as typeof fetch;
  const threw: typeof fetch = (async () => {
    throw new TypeError('Failed to fetch');
  }) as unknown as typeof fetch;

  it('returns parsed instances on success', async () => {
    const inst = await listSqlInstances('p', 't', ok({ items: [{ name: 'db', region: 'r' }] }));
    expect(inst).toEqual([{ name: 'db', region: 'r', databaseVersion: undefined, tier: undefined, state: undefined }]);
  });

  it('throws an ApiError carrying the mapped info on HTTP errors', async () => {
    await expect(listSqlInstances('p', 't', fail(401, {}))).rejects.toMatchObject({
      name: 'ApiError',
      info: { kind: 'auth' },
    });
  });

  it('classifies a thrown fetch as a CORS/network error', async () => {
    await expect(listSqlInstances('p', 't', threw)).rejects.toBeInstanceOf(ApiError);
    await expect(listSqlInstances('p', 't', threw)).rejects.toMatchObject({ info: { kind: 'cors' } });
  });
});
