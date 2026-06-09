import { useCallback, useEffect, useMemo, useRef, useState } from 'preact/hooks';
import type { AppProps } from '../../sdk';
import { Button, Checkbox, CopyButton, Field, Input, Select, TextArea, Toolbar } from '../../ui';
import { CodeEditor } from '../../ui/code';
import {
  DEFAULT_SLOW_MS,
  newId,
  parseCurl,
  pushHistory,
  successRatio,
  summarize,
  type BodyMode,
  type Check,
  type CheckResult,
  type FetchMode,
  type HistoryEntry,
  type HttpCheck,
  type Method,
  type Outcome,
} from './logic';
import { runHttpCheck } from './runner';
import { runJsCheck } from './sandbox';

const CHECKS_KEY = 'checks';
const HISTORY_KEY = 'history';
const METHODS: Method[] = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD'];

const SEED: Check[] = [
  {
    id: newId(),
    kind: 'http',
    name: 'GitHub API',
    enabled: true,
    method: 'GET',
    url: 'https://api.github.com',
    expect: '2xx',
    bodyMode: 'contains',
    bodyMatch: 'current_user_url',
  },
  {
    id: newId(),
    kind: 'js',
    name: 'GitHub status (JS)',
    enabled: true,
    source:
      "async ({ fetch }) => {\n  const res = await fetch('https://api.github.com');\n  const body = await res.json();\n  return { ok: res.status === 200 && !!body.current_user_url, status: res.status };\n}",
  },
];

const OUTCOME_LABEL: Record<Outcome, string> = {
  pass: 'Pass',
  fail: 'Fail',
  opaque: 'Reachable',
  timeout: 'Timeout',
  error: 'Error',
  pending: 'Running…',
};

// ---------- draft form model ----------

interface HttpDraft {
  id: string;
  kind: 'http';
  name: string;
  enabled: boolean;
  method: Method;
  url: string;
  expect: string;
  headersText: string;
  body: string;
  bodyMode: BodyMode;
  bodyMatch: string;
  mode: FetchMode;
  timeoutSec: string;
  curlText: string;
}
interface JsDraft {
  id: string;
  kind: 'js';
  name: string;
  enabled: boolean;
  source: string;
  timeoutSec: string;
}
type Draft = HttpDraft | JsDraft;

const headersToText = (h?: Record<string, string>) =>
  h ? Object.entries(h).map(([k, v]) => `${k}: ${v}`).join('\n') : '';

function textToHeaders(text: string): Record<string, string> | undefined {
  const out: Record<string, string> = {};
  for (const line of text.split('\n')) {
    const idx = line.indexOf(':');
    if (idx > 0) out[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
  }
  return Object.keys(out).length ? out : undefined;
}

function emptyHttpDraft(): HttpDraft {
  return {
    id: newId(),
    kind: 'http',
    name: '',
    enabled: true,
    method: 'GET',
    url: '',
    expect: '2xx',
    headersText: '',
    body: '',
    bodyMode: 'contains',
    bodyMatch: '',
    mode: 'auto',
    timeoutSec: '10',
    curlText: '',
  };
}

function emptyJsDraft(): JsDraft {
  return {
    id: newId(),
    kind: 'js',
    name: '',
    enabled: true,
    source: 'async ({ fetch }) => {\n  const res = await fetch(\'https://example.com\');\n  return { ok: res.status === 200, status: res.status };\n}',
    timeoutSec: '10',
  };
}

function toDraft(check: Check): Draft {
  if (check.kind === 'js') {
    return { ...emptyJsDraft(), id: check.id, name: check.name, enabled: check.enabled, source: check.source, timeoutSec: String((check.timeoutMs ?? 10000) / 1000) };
  }
  return {
    ...emptyHttpDraft(),
    id: check.id,
    name: check.name,
    enabled: check.enabled,
    method: check.method,
    url: check.url,
    expect: check.expect,
    headersText: headersToText(check.headers),
    body: check.body ?? '',
    bodyMode: check.bodyMode ?? 'contains',
    bodyMatch: check.bodyMatch ?? '',
    mode: check.mode ?? 'auto',
    timeoutSec: String((check.timeoutMs ?? 10000) / 1000),
    curlText: check.curl ?? '',
  };
}

function fromDraft(d: Draft): Check {
  const timeoutMs = Math.max(1, Number(d.timeoutSec) || 10) * 1000;
  if (d.kind === 'js') {
    return { id: d.id, kind: 'js', name: d.name || 'Untitled', enabled: d.enabled, source: d.source, timeoutMs };
  }
  const check: HttpCheck = {
    id: d.id,
    kind: 'http',
    name: d.name || 'Untitled',
    enabled: d.enabled,
    method: d.method,
    url: d.url.trim(),
    expect: d.expect.trim() || '2xx',
    headers: textToHeaders(d.headersText),
    body: d.body || undefined,
    bodyMode: d.bodyMode,
    bodyMatch: d.bodyMatch || undefined,
    mode: d.mode,
    timeoutMs,
    curl: d.curlText || undefined,
  };
  return check;
}

// ---------- view ----------

function Sparkline({ history }: { history?: HistoryEntry[] }) {
  const recent = (history ?? []).slice(-20);
  if (recent.length === 0) return null;
  return (
    <span class="spark" title={`${Math.round(successRatio(history) * 100)}% pass over last ${recent.length}`}>
      {recent.map((e, i) => (
        <i key={i} class={`dot-${e.outcome}`} />
      ))}
    </span>
  );
}

export default function HealthApp({ ctx }: AppProps) {
  const [checks, setChecks] = useState<Check[]>([]);
  const [results, setResults] = useState<Record<string, CheckResult>>({});
  const [history, setHistory] = useState<Record<string, HistoryEntry[]>>({});
  const [running, setRunning] = useState<Set<string>>(new Set());
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [draft, setDraft] = useState<Draft | null>(null);
  const [io, setIo] = useState<string | null>(null);
  const [curlNote, setCurlNote] = useState<string | null>(null);
  const loaded = useRef(false);

  const runCheck = useCallback(async (check: Check) => {
    setRunning((s) => new Set(s).add(check.id));
    setResults((r) => ({ ...r, [check.id]: { outcome: 'pending', at: Date.now() } }));
    const res = check.kind === 'http' ? await runHttpCheck(check) : await runJsCheck(check);
    setResults((r) => ({ ...r, [check.id]: res }));
    setHistory((h) => ({
      ...h,
      [check.id]: pushHistory(h[check.id], { at: res.at, outcome: res.outcome, latencyMs: res.latencyMs }),
    }));
    setRunning((s) => {
      const n = new Set(s);
      n.delete(check.id);
      return n;
    });
    return res;
  }, []);

  const runList = useCallback(
    async (list: Check[]) => {
      const queue = list.filter((c) => c.enabled);
      const lanes = Math.min(4, Math.max(1, queue.length));
      await Promise.all(
        Array.from({ length: lanes }, async () => {
          let next: Check | undefined;
          while ((next = queue.shift())) await runCheck(next);
        }),
      );
    },
    [runCheck],
  );

  // Load persisted config + history, then auto-run on open.
  useEffect(() => {
    (async () => {
      const savedChecks = await ctx.storage.get<Check[]>(CHECKS_KEY);
      const savedHistory = await ctx.storage.get<Record<string, HistoryEntry[]>>(HISTORY_KEY);
      const initial = savedChecks && savedChecks.length ? savedChecks : SEED;
      setChecks(initial);
      if (savedHistory) setHistory(savedHistory);
      loaded.current = true;
      void runList(initial);
    })();
  }, [ctx, runList]);

  useEffect(() => {
    if (loaded.current) void ctx.storage.set(CHECKS_KEY, checks);
  }, [ctx, checks]);
  useEffect(() => {
    if (loaded.current) void ctx.storage.set(HISTORY_KEY, history);
  }, [ctx, history]);

  useEffect(() => {
    ctx.registerCommands([
      { id: 'health:run', title: 'Health: Run all checks', run: () => void runList(checks) },
      { id: 'health:add', title: 'Health: Add check', run: () => setDraft(emptyHttpDraft()) },
    ]);
  }, [ctx, checks, runList]);

  const summary = useMemo(() => summarize(results, checks), [results, checks]);
  const anyRunning = running.size > 0;

  const upsert = (check: Check) =>
    setChecks((cs) => {
      const i = cs.findIndex((c) => c.id === check.id);
      if (i === -1) return [...cs, check];
      const copy = cs.slice();
      copy[i] = check;
      return copy;
    });

  const toggleExpand = (id: string) =>
    setExpanded((s) => {
      const n = new Set(s);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });

  const importConfig = () => {
    if (io === null) return;
    try {
      const parsed = JSON.parse(io) as Check[];
      if (!Array.isArray(parsed)) throw new Error('Expected an array of checks');
      setChecks(parsed);
      setIo(null);
    } catch (e) {
      setCurlNote(`Import failed: ${e instanceof Error ? e.message : 'invalid JSON'}`);
    }
  };

  return (
    <div class="stack">
      <div class="health-bar">
        <Button variant="primary" onClick={() => void runList(checks)} disabled={anyRunning}>
          {anyRunning ? 'Running…' : 'Run all'}
        </Button>
        <span class="summary-pill">
          <b class="dot-pass" /> {summary.pass}
          <b class="dot-fail" /> {summary.fail}
          {summary.other > 0 && (
            <>
              <b class="dot-opaque" /> {summary.other}
            </>
          )}
          <span class="note"> / {summary.total} enabled</span>
        </span>
        <span class="health-spacer" />
        <Button onClick={() => setDraft(emptyHttpDraft())}>+ Add check</Button>
        <Button
          variant="ghost"
          onClick={() => setIo(io === null ? JSON.stringify(checks, null, 2) : null)}
        >
          Import / Export
        </Button>
      </div>

      {io !== null && (
        <div class="io-panel stack">
          <Field label="Config JSON (edit and import, or copy to back up)">
            <TextArea class="tall" value={io} onInput={(e) => setIo((e.target as HTMLTextAreaElement).value)} />
          </Field>
          <Toolbar>
            <Button variant="primary" onClick={importConfig}>
              Import (replace all)
            </Button>
            <CopyButton label="Copy config" value={io} />
            <Button variant="ghost" onClick={() => setIo(null)}>
              Close
            </Button>
          </Toolbar>
          {curlNote && <p class="error-text">{curlNote}</p>}
        </div>
      )}

      {checks.length === 0 && <p class="empty">No checks yet — add one to get started.</p>}

      {checks.map((check) => {
        const res = results[check.id];
        const outcome: Outcome = running.has(check.id) ? 'pending' : res?.outcome ?? 'pending';
        const slow =
          res?.outcome === 'pass' && res.latencyMs !== undefined && res.latencyMs > (check.slowMs ?? DEFAULT_SLOW_MS);
        return (
          <div class={`check-card ${check.enabled ? '' : 'disabled'}`} key={check.id}>
            <div class="check-main" onClick={() => toggleExpand(check.id)}>
              <span class={`status-dot dot-${outcome}`} title={OUTCOME_LABEL[outcome]} />
              <span class="check-name">
                {check.name}
                <span class="check-kind">{check.kind === 'js' ? 'JS' : check.method}</span>
              </span>
              <Sparkline history={history[check.id]} />
              <span class="check-meta">
                {res?.status !== undefined && <span>HTTP {res.status}</span>}
                {res?.latencyMs !== undefined && <span class={slow ? 'slow' : ''}>{res.latencyMs} ms</span>}
                <span>{OUTCOME_LABEL[outcome]}</span>
              </span>
            </div>

            {expanded.has(check.id) && (
              <div class="check-detail">
                {check.kind === 'http' && <p class="note mono">{check.method} {check.url}</p>}
                {res?.message && <p class="note">{res.message}</p>}
                <Toolbar>
                  <Button onClick={() => void runCheck(check)} disabled={running.has(check.id)}>
                    Run
                  </Button>
                  <Button variant="ghost" onClick={() => setDraft(toDraft(check))}>
                    Edit
                  </Button>
                  <Checkbox
                    label="Enabled"
                    checked={check.enabled}
                    onChange={(e) =>
                      upsert({ ...check, enabled: (e.target as HTMLInputElement).checked })
                    }
                  />
                  <Button
                    variant="ghost"
                    onClick={() => setChecks((cs) => cs.filter((c) => c.id !== check.id))}
                  >
                    Delete
                  </Button>
                </Toolbar>
              </div>
            )}
          </div>
        );
      })}

      {draft && (
        <Editor
          draft={draft}
          setDraft={setDraft}
          onSave={() => {
            upsert(fromDraft(draft));
            const saved = fromDraft(draft);
            setDraft(null);
            void runCheck(saved);
          }}
        />
      )}
    </div>
  );
}

// ---------- editor panel ----------

function Editor({
  draft,
  setDraft,
  onSave,
}: {
  draft: Draft;
  setDraft: (d: Draft | null) => void;
  onSave: () => void;
}) {
  const [curlText, setCurlText] = useState(draft.kind === 'http' ? draft.curlText : '');
  const [curlInfo, setCurlInfo] = useState<string | null>(null);

  const set = (patch: Partial<HttpDraft> & Partial<JsDraft>) =>
    setDraft({ ...draft, ...patch } as Draft);

  const applyCurl = () => {
    const { check, unsupported, error } = parseCurl(curlText);
    if (error) {
      setCurlInfo(error);
      return;
    }
    setCurlInfo(unsupported.length ? `Ignored unsupported flags: ${unsupported.join(', ')}` : 'Parsed ✓');
    setDraft({
      ...(draft as HttpDraft),
      kind: 'http',
      method: (check.method as Method) ?? 'GET',
      url: check.url ?? '',
      headersText: headersToText(check.headers),
      body: check.body ?? '',
      curlText,
      timeoutSec: check.timeoutMs ? String(check.timeoutMs / 1000) : (draft as HttpDraft).timeoutSec,
    });
  };

  return (
    <div class="editor-panel stack">
      <Toolbar>
        <Field label="Type">
          <Select
            value={draft.kind}
            onInput={(e) => {
              const kind = (e.target as HTMLSelectElement).value;
              setDraft(kind === 'js' ? { ...emptyJsDraft(), id: draft.id, name: draft.name } : { ...emptyHttpDraft(), id: draft.id, name: draft.name });
            }}
          >
            <option value="http">HTTP (form / curl)</option>
            <option value="js">Async JS function</option>
          </Select>
        </Field>
        <Field label="Name">
          <Input value={draft.name} onInput={(e) => set({ name: (e.target as HTMLInputElement).value })} />
        </Field>
        <Field label="Timeout (s)">
          <Input
            type="number"
            min={1}
            value={draft.timeoutSec}
            onInput={(e) => set({ timeoutSec: (e.target as HTMLInputElement).value })}
          />
        </Field>
      </Toolbar>

      {draft.kind === 'http' ? (
        <>
          <Field label="Import from curl (optional)">
            <TextArea
              value={curlText}
              placeholder="curl -H 'Accept: application/json' https://api.example.com/health"
              onInput={(e) => setCurlText((e.target as HTMLTextAreaElement).value)}
            />
          </Field>
          <Toolbar>
            <Button onClick={applyCurl} disabled={!curlText.trim()}>
              Parse curl → fields
            </Button>
            {curlInfo && <span class="note">{curlInfo}</span>}
          </Toolbar>

          <Toolbar>
            <Field label="Method">
              <Select value={draft.method} onInput={(e) => set({ method: (e.target as HTMLSelectElement).value as Method })}>
                {METHODS.map((m) => (
                  <option value={m}>{m}</option>
                ))}
              </Select>
            </Field>
            <Field label="URL">
              <Input
                value={draft.url}
                placeholder="https://api.example.com/health"
                onInput={(e) => set({ url: (e.target as HTMLInputElement).value })}
              />
            </Field>
          </Toolbar>

          <Toolbar>
            <Field label="Expected status">
              <Input value={draft.expect} placeholder="2xx, 200-204, 200" onInput={(e) => set({ expect: (e.target as HTMLInputElement).value })} />
            </Field>
            <Field label="CORS mode">
              <Select value={draft.mode} onInput={(e) => set({ mode: (e.target as HTMLSelectElement).value as FetchMode })}>
                <option value="auto">Auto (cors → no-cors)</option>
                <option value="cors">cors only</option>
                <option value="no-cors">no-cors (reachability)</option>
              </Select>
            </Field>
          </Toolbar>

          <Field label="Headers (one per line: Key: Value)">
            <TextArea
              value={draft.headersText}
              placeholder={'Accept: application/json\nAuthorization: Bearer …'}
              onInput={(e) => set({ headersText: (e.target as HTMLTextAreaElement).value })}
            />
          </Field>

          <Field label="Request body (POST/PUT/…)">
            <TextArea value={draft.body} onInput={(e) => set({ body: (e.target as HTMLTextAreaElement).value })} />
          </Field>

          <Toolbar>
            <Field label="Body assertion">
              <Select value={draft.bodyMode} onInput={(e) => set({ bodyMode: (e.target as HTMLSelectElement).value as BodyMode })}>
                <option value="contains">contains text</option>
                <option value="regex">matches regex</option>
              </Select>
            </Field>
            <Field label="Body match (optional)">
              <Input value={draft.bodyMatch} onInput={(e) => set({ bodyMatch: (e.target as HTMLInputElement).value })} />
            </Field>
          </Toolbar>
        </>
      ) : (
        <Field label="async ({ fetch }) => result">
          <CodeEditor
            class="tall"
            language="javascript"
            value={draft.source}
            onInput={(e) => set({ source: e.currentTarget.value })}
          />
        </Field>
      )}

      <p class="note">
        Runs in your browser only. HTTP auth headers and JS source are stored in plaintext on this device.
        {draft.kind === 'js' && ' JS checks execute in a sandboxed Web Worker.'}
      </p>

      <Toolbar>
        <Button variant="primary" onClick={onSave} disabled={draft.kind === 'http' && !draft.url.trim()}>
          Save &amp; run
        </Button>
        <Button variant="ghost" onClick={() => setDraft(null)}>
          Cancel
        </Button>
      </Toolbar>
    </div>
  );
}
