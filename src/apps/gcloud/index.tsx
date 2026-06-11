import { useEffect, useRef, useState } from 'preact/hooks';
import type { AppProps } from '../../sdk';
import { Button, Card, Field, Input, Select, Toolbar } from '../../ui';
import { CodeBlock } from '../../ui/code';
import { acquireToken, getToken, signOut as authSignOut } from './auth';
import { ApiError, fetchLogs, fetchTimeSeries, listRunServices, listSqlInstances } from './api';
import {
  METRICS,
  TIME_RANGES,
  alignmentPeriodFor,
  buildLoggingFilter,
  buildMonitoringFilter,
  formatMetricValue,
  latestValue,
  loggingRequestBody,
  monitoringQueryParams,
  relativeTime,
  scopesFor,
  sparklinePath,
  timeRangeToInterval,
  type MetricSeries,
  type LogRow,
  type ResourceKind,
  type RunService,
  type ScopeMode,
  type SqlInstance,
  type TimeRangeId,
  type TokenState,
} from './logic';

const STORAGE_KEY = 'settings';
const LOG_PAGE_SIZE = 50;

interface Selection {
  kind: ResourceKind;
  name: string;
  region: string;
}

interface Settings {
  clientId: string;
  projectId: string;
  regions: string;
  scopeMode: ScopeMode;
  rangeId: TimeRangeId;
  severity: string;
  selected: Selection | null;
}

const DEFAULTS: Settings = {
  clientId: '',
  projectId: '',
  regions: 'us-central1',
  scopeMode: 'narrow',
  rangeId: '1h',
  severity: 'DEFAULT',
  selected: null,
};

const SEVERITIES = ['DEFAULT', 'INFO', 'WARNING', 'ERROR'];

/** The Monitoring/Logging resource id for a selection. */
function resourceId(sel: Selection, projectId: string): string {
  return sel.kind === 'run' ? sel.name : `${projectId}:${sel.name}`;
}

export default function GCloudApp({ ctx }: AppProps) {
  const [settings, setSettings] = useState<Settings>(DEFAULTS);
  const [token, setToken] = useState<TokenState | null>(() => getToken());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reconnect, setReconnect] = useState(false);

  const [runServices, setRunServices] = useState<RunService[]>([]);
  const [sqlInstances, setSqlInstances] = useState<SqlInstance[]>([]);
  const [metrics, setMetrics] = useState<MetricSeries[] | null>(null);
  const [logs, setLogs] = useState<LogRow[] | null>(null);

  const loaded = useRef(false);
  const patch = (p: Partial<Settings>) => setSettings((s) => ({ ...s, ...p }));

  useEffect(() => {
    ctx.storage.get<Settings>(STORAGE_KEY).then((saved) => {
      if (saved) setSettings({ ...DEFAULTS, ...saved });
      loaded.current = true;
    });
  }, [ctx]);

  useEffect(() => {
    if (!loaded.current) return;
    void ctx.storage.set<Settings>(STORAGE_KEY, settings);
  }, [ctx, settings]);

  // Centralised error handling: an auth error drops back to the reconnect gesture.
  const handleError = (e: unknown) => {
    if (e instanceof ApiError && e.info.kind === 'auth') {
      authSignOut(token?.accessToken);
      setToken(null);
      setReconnect(true);
    }
    setError(e instanceof Error ? e.message : 'Something went wrong.');
  };

  const loadInventory = async (tok: TokenState) => {
    const { projectId, regions } = settings;
    if (!projectId) return;
    setBusy(true);
    setError(null);
    try {
      const regionList = regions
        .split(',')
        .map((r) => r.trim())
        .filter(Boolean);
      const runResults = await Promise.all(
        regionList.map((r) => listRunServices(projectId, r, tok.accessToken)),
      );
      setRunServices(runResults.flat());
      setSqlInstances(await listSqlInstances(projectId, tok.accessToken));
    } catch (e) {
      handleError(e);
    } finally {
      setBusy(false);
    }
  };

  const loadMetricsAndLogs = async (sel: Selection, tok: TokenState) => {
    const { projectId, rangeId, severity } = settings;
    setBusy(true);
    setError(null);
    const rid = resourceId(sel, projectId);
    const interval = timeRangeToInterval(rangeId, Date.now());
    const period = alignmentPeriodFor(rangeId);
    try {
      const series = await Promise.all(
        METRICS[sel.kind].map(async (def) => {
          const filter = buildMonitoringFilter(def.type, sel.kind, rid);
          const params = monitoringQueryParams(filter, interval, period, def.aligner);
          const result = await fetchTimeSeries(projectId, params, tok.accessToken);
          const first = result[0] ?? { metricType: def.type, label: def.label, points: [] };
          return { ...first, label: def.label };
        }),
      );
      setMetrics(series);

      const logFilter = buildLoggingFilter(sel.kind, rid, {
        severity,
        sinceRfc3339: interval.startTime,
      });
      const body = loggingRequestBody(projectId, logFilter, LOG_PAGE_SIZE);
      setLogs(await fetchLogs(body, tok.accessToken));
    } catch (e) {
      handleError(e);
    } finally {
      setBusy(false);
    }
  };

  const connect = async () => {
    if (!settings.clientId.trim() || !settings.projectId.trim()) {
      setError('Enter your OAuth Client ID and project ID first.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const tok = await acquireToken(settings.clientId.trim(), scopesFor(settings.scopeMode));
      setToken(tok);
      setReconnect(false);
      await loadInventory(tok);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not connect.');
    } finally {
      setBusy(false);
    }
  };

  const select = (sel: Selection) => {
    patch({ selected: sel });
    if (token) void loadMetricsAndLogs(sel, token);
  };

  const refresh = () => {
    if (!token) return;
    void loadInventory(token);
    if (settings.selected) void loadMetricsAndLogs(settings.selected, token);
  };

  const signOut = () => {
    authSignOut(token?.accessToken);
    setToken(null);
    setReconnect(false);
    setRunServices([]);
    setSqlInstances([]);
    setMetrics(null);
    setLogs(null);
  };

  useEffect(() => {
    ctx.registerCommands([
      { id: 'gcloud:refresh', title: 'Cloud Monitor: Refresh', run: refresh },
      { id: 'gcloud:signout', title: 'Cloud Monitor: Sign out', run: signOut },
      { id: 'gcloud:range-1h', title: 'Cloud Monitor: Last 1 hour', run: () => patch({ rangeId: '1h' }) },
      { id: 'gcloud:range-24h', title: 'Cloud Monitor: Last 24 hours', run: () => patch({ rangeId: '24h' }) },
    ]);
  });

  const connected = token && !reconnect;
  const sel = settings.selected;

  if (!connected) {
    return (
      <div class="stack">
        <Card class="gc-connect">
          <h2>Connect to Google Cloud</h2>
          <p class="note">
            Uses Google sign-in directly from your browser — read-only. Your access token stays in this
            browser session and is never sent anywhere but Google. Create an OAuth 2.0 <strong>Web</strong>{' '}
            client in your GCP project, add <code>{location.origin}</code> to its “Authorized JavaScript
            origins”, then paste its Client ID below.
          </p>
          <Field label="OAuth Client ID">
            <Input
              value={settings.clientId}
              placeholder="1234-abc.apps.googleusercontent.com"
              onInput={(e) => patch({ clientId: (e.target as HTMLInputElement).value })}
            />
          </Field>
          <Field label="Project ID">
            <Input
              value={settings.projectId}
              placeholder="my-gcp-project"
              onInput={(e) => patch({ projectId: (e.target as HTMLInputElement).value })}
            />
          </Field>
          <Field label="Scopes">
            <Select
              value={settings.scopeMode}
              onInput={(e) => patch({ scopeMode: (e.target as HTMLSelectElement).value as ScopeMode })}
            >
              <option value="narrow">Narrow (monitoring + logging + read-only)</option>
              <option value="broad">Broad (cloud-platform read-only)</option>
            </Select>
          </Field>
          <Toolbar>
            <Button variant="primary" onClick={connect} disabled={busy}>
              {busy ? 'Connecting…' : reconnect ? 'Reconnect' : 'Connect'}
            </Button>
          </Toolbar>
          {error && <p class="error-text">{error}</p>}
        </Card>
      </div>
    );
  }

  return (
    <div class="stack">
      <Toolbar>
        <span class="gc-project">{settings.projectId}</span>
        <Field label="Range">
          <Select
            value={settings.rangeId}
            onInput={(e) => {
              const rangeId = (e.target as HTMLSelectElement).value as TimeRangeId;
              patch({ rangeId });
              if (token && sel) void loadMetricsAndLogs(sel, token);
            }}
          >
            {TIME_RANGES.map((r) => (
              <option value={r.id}>{r.label}</option>
            ))}
          </Select>
        </Field>
        <Field label="Regions (Cloud Run)">
          <Input
            value={settings.regions}
            placeholder="us-central1, europe-west1"
            onInput={(e) => patch({ regions: (e.target as HTMLInputElement).value })}
          />
        </Field>
        <Button onClick={refresh} disabled={busy}>
          {busy ? 'Loading…' : 'Refresh'}
        </Button>
        <Button variant="ghost" onClick={signOut}>
          Sign out
        </Button>
      </Toolbar>

      {error && <p class="error-text">{error}</p>}

      <div class="gc-grid">
        <div class="gc-list">
          <h3>Cloud Run</h3>
          {runServices.length === 0 && <p class="note">No services found.</p>}
          {runServices.map((s) => (
            <ResourceRow
              key={`run:${s.region}:${s.name}`}
              title={s.name}
              subtitle={s.region}
              active={sel?.kind === 'run' && sel.name === s.name}
              onClick={() => select({ kind: 'run', name: s.name, region: s.region })}
            />
          ))}
          <h3>Cloud SQL</h3>
          {sqlInstances.length === 0 && <p class="note">No instances found.</p>}
          {sqlInstances.map((i) => (
            <ResourceRow
              key={`sql:${i.name}`}
              title={i.name}
              subtitle={[i.databaseVersion, i.tier, i.state].filter(Boolean).join(' · ')}
              active={sel?.kind === 'sql' && sel.name === i.name}
              onClick={() => select({ kind: 'sql', name: i.name, region: i.region })}
            />
          ))}
        </div>

        <div class="gc-detail">
          {!sel && <p class="note">Select a service or instance to see metrics and logs.</p>}
          {sel && (
            <>
              <h3>
                {sel.name} <span class="gc-muted">metrics</span>
              </h3>
              <div class="gc-metrics">
                {(metrics ?? []).map((m) => (
                  <MetricCard key={m.label} series={m} unit={metricUnit(sel.kind, m.label)} />
                ))}
              </div>

              <div class="gc-logs-head">
                <h3>
                  Logs <span class="gc-muted">most recent</span>
                </h3>
                <Field label="Severity">
                  <Select
                    value={settings.severity}
                    onInput={(e) => {
                      patch({ severity: (e.target as HTMLSelectElement).value });
                      if (token) void loadMetricsAndLogs(sel, token);
                    }}
                  >
                    {SEVERITIES.map((s) => (
                      <option value={s}>{s}</option>
                    ))}
                  </Select>
                </Field>
              </div>
              {logs && logs.length === 0 && <p class="note">No log entries in this range.</p>}
              {logs && logs.length > 0 && (
                <CodeBlock
                  language="none"
                  class="gc-logblock"
                  code={logs
                    .map((l) => `${relativeTime(l.timestamp, Date.now())} [${l.severity}] ${l.text}`)
                    .join('\n')}
                />
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function metricUnit(kind: ResourceKind, label: string) {
  return METRICS[kind].find((m) => m.label === label)?.unit ?? 'count';
}

function ResourceRow({
  title,
  subtitle,
  active,
  onClick,
}: {
  title: string;
  subtitle?: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button class={`gc-row ${active ? 'gc-row-active' : ''}`} onClick={onClick}>
      <span class="gc-row-title">{title}</span>
      {subtitle && <span class="gc-row-sub">{subtitle}</span>}
    </button>
  );
}

function MetricCard({
  series,
  unit,
}: {
  series: MetricSeries;
  unit: import('./logic').MetricUnit;
}) {
  const latest = latestValue(series);
  const path = sparklinePath(series.points, 120, 32);
  return (
    <div class="gc-metric">
      <div class="gc-metric-head">
        <span>{series.label}</span>
        <strong>{latest != null ? formatMetricValue(latest, unit) : '—'}</strong>
      </div>
      <svg class="gc-spark" viewBox="0 0 120 32" preserveAspectRatio="none" aria-hidden="true">
        {path ? <path d={path} /> : null}
      </svg>
    </div>
  );
}
