import { useCallback, useEffect, useMemo, useRef, useState } from 'preact/hooks';
import type { AppProps } from '../../sdk';
import { Button, Checkbox, CopyButton, Field, Input, Select, TextArea, Toolbar } from '../../ui';
import { CodeEditor } from '../../ui/code';
import {
  aggregateOutcome,
  DEFAULT_SLOW_MS,
  formatBytes,
  groupChecks,
  moveCheckRelative,
  moveCheckToGroupEnd,
  moveGroupRelative,
  newId,
  parseCurl,
  pushHistory,
  successRatio,
  summarize,
  type BodyMode,
  type Check,
  type CheckResult,
  type DropPosition,
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
const COLLAPSED_KEY = 'collapsed';
const METHODS: Method[] = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD'];

const SEED: Check[] = [
  {
    id: newId(),
    kind: 'http',
    name: 'GitHub API',
    group: 'Examples',
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
    group: 'Examples',
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
  group: string;
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
  group: string;
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
    group: '',
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
    group: '',
    enabled: true,
    source: 'async ({ fetch }) => {\n  const res = await fetch(\'https://example.com\');\n  return { ok: res.status === 200, status: res.status };\n}',
    timeoutSec: '10',
  };
}

function toDraft(check: Check): Draft {
  if (check.kind === 'js') {
    return { ...emptyJsDraft(), id: check.id, name: check.name, group: check.group ?? '', enabled: check.enabled, source: check.source, timeoutSec: String((check.timeoutMs ?? 10000) / 1000) };
  }
  return {
    ...emptyHttpDraft(),
    id: check.id,
    name: check.name,
    group: check.group ?? '',
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
  const group = d.group.trim() || undefined;
  if (d.kind === 'js') {
    return { id: d.id, kind: 'js', name: d.name || 'Untitled', group, enabled: d.enabled, source: d.source, timeoutMs };
  }
  const check: HttpCheck = {
    id: d.id,
    kind: 'http',
    name: d.name || 'Untitled',
    group,
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
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [draft, setDraft] = useState<Draft | null>(null);
  const [io, setIo] = useState<string | null>(null);
  const [curlNote, setCurlNote] = useState<string | null>(null);
  const [drag, setDrag] = useState<{ type: 'check' | 'group'; key: string } | null>(null);
  const [dropHint, setDropHint] = useState<{ key: string; pos: DropPosition | 'into' } | null>(null);
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
      const savedCollapsed = await ctx.storage.get<string[]>(COLLAPSED_KEY);
      const initial = savedChecks && savedChecks.length ? savedChecks : SEED;
      setChecks(initial);
      if (savedHistory) setHistory(savedHistory);
      if (savedCollapsed) setCollapsed(new Set(savedCollapsed));
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
    if (loaded.current) void ctx.storage.set(COLLAPSED_KEY, [...collapsed]);
  }, [ctx, collapsed]);

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

  const toggleCollapse = (name: string) =>
    setCollapsed((s) => {
      const n = new Set(s);
      n.has(name) ? n.delete(name) : n.add(name);
      return n;
    });

  // ---- drag & drop ----
  const startDrag = (e: DragEvent, type: 'check' | 'group', key: string) => {
    setDrag({ type, key });
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = 'move';
      // Firefox requires data to be set for a drag to start at all.
      e.dataTransfer.setData('text/plain', key);
    }
  };
  const endDrag = () => {
    setDrag(null);
    setDropHint(null);
  };
  const edgePosition = (e: DragEvent): DropPosition => {
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    return e.clientY - r.top < r.height / 2 ? 'before' : 'after';
  };

  const onCardDragOver = (id: string) => (e: DragEvent) => {
    if (drag?.type !== 'check') return; // groups are handled by the group container
    e.preventDefault();
    setDropHint({ key: id, pos: edgePosition(e) });
  };
  const onCardDrop = (id: string) => (e: DragEvent) => {
    if (drag?.type !== 'check') return;
    e.preventDefault();
    const pos = dropHint?.key === id && dropHint.pos !== 'into' ? dropHint.pos : 'before';
    setChecks((cs) => moveCheckRelative(cs, drag.key, id, pos));
    endDrag();
  };

  // The whole group block is the drop target for reordering groups.
  const onGroupDragOver = (name: string) => (e: DragEvent) => {
    if (drag?.type !== 'group') return;
    e.preventDefault();
    setDropHint({ key: `g:${name}`, pos: edgePosition(e) });
  };
  const onGroupDrop = (name: string) => (e: DragEvent) => {
    if (drag?.type !== 'group') return;
    e.preventDefault();
    const pos = dropHint?.pos === 'after' ? 'after' : 'before';
    setChecks((cs) => moveGroupRelative(cs, drag.key.slice(2), name, pos));
    endDrag();
  };
  // The header is where you drop a check to move it INTO the group.
  const onHeaderDragOver = (name: string) => (e: DragEvent) => {
    if (drag?.type !== 'check') return;
    e.preventDefault();
    e.stopPropagation();
    setDropHint({ key: `gi:${name}`, pos: 'into' });
  };
  const onHeaderDrop = (name: string) => (e: DragEvent) => {
    if (drag?.type !== 'check') return;
    e.preventDefault();
    e.stopPropagation();
    setChecks((cs) => moveCheckToGroupEnd(cs, drag.key, name));
    endDrag();
  };

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

  const groupNames = [...new Set(checks.map((c) => c.group).filter((g): g is string => !!g))];
  const saveDraft = (d: Draft) => {
    const saved = fromDraft(d);
    upsert(saved);
    setDraft(null);
    void runCheck(saved);
  };
  const renderEditor = () =>
    draft && <Editor draft={draft} setDraft={setDraft} groupNames={groupNames} onSave={() => saveDraft(draft)} />;
  const isEditingExisting = draft != null && checks.some((c) => c.id === draft.id);

  const renderCard = (check: Check) => {
    const res = results[check.id];
    const outcome: Outcome = running.has(check.id) ? 'pending' : res?.outcome ?? 'pending';
    const slow =
      res?.outcome === 'pass' && res.latencyMs !== undefined && res.latencyMs > (check.slowMs ?? DEFAULT_SLOW_MS);
    const dropCls = dropHint?.key === check.id && dropHint.pos !== 'into' ? `drop-${dropHint.pos}` : '';
    const draggingCls = drag?.type === 'check' && drag.key === check.id ? 'dragging' : '';
    return (
      <div
        class={`check-card ${check.enabled ? '' : 'disabled'} ${dropCls} ${draggingCls}`}
        key={check.id}
        onDragOver={onCardDragOver(check.id)}
        onDrop={onCardDrop(check.id)}
      >
        <div
          class="check-main"
          draggable
          onDragStart={(e) => startDrag(e, 'check', check.id)}
          onDragEnd={endDrag}
        >
          <span class="grip" title="Drag to reorder">
            ⠿
          </span>
          <span class={`status-dot dot-${outcome}`} title={OUTCOME_LABEL[outcome]} />
          <button class="check-name-btn" onClick={() => toggleExpand(check.id)}>
            <span class="check-name">
              {check.name}
              <span class="check-kind">{check.kind === 'js' ? 'JS' : check.method}</span>
            </span>
          </button>
          <Sparkline history={history[check.id]} />
          <span class="check-meta">
            {res?.status !== undefined && <span>HTTP {res.status}</span>}
            {res?.sizeBytes !== undefined && <span>{formatBytes(res.sizeBytes)}</span>}
            {res?.latencyMs !== undefined && <span class={slow ? 'slow' : ''}>{res.latencyMs} ms</span>}
            <span>{OUTCOME_LABEL[outcome]}</span>
          </span>
        </div>

        {draft?.id === check.id ? (
          <div class="check-detail">{renderEditor()}</div>
        ) : (
          expanded.has(check.id) && (
            <div class="check-detail">
              {check.kind === 'http' && (
                <p class="note mono">
                  {check.method} {check.url}
                </p>
              )}
              {res?.message && <p class="note">{res.message}</p>}
              <div class="check-actions">
                <Button onClick={() => void runCheck(check)} disabled={running.has(check.id)}>
                  Run
                </Button>
                <Button variant="ghost" onClick={() => setDraft(toDraft(check))}>
                  Edit
                </Button>
                <Checkbox
                  label="Enabled"
                  checked={check.enabled}
                  onChange={(e) => upsert({ ...check, enabled: (e.target as HTMLInputElement).checked })}
                />
                <Button variant="ghost" onClick={() => setChecks((cs) => cs.filter((c) => c.id !== check.id))}>
                  Delete
                </Button>
              </div>
            </div>
          )
        )}
      </div>
    );
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

      {draft && !isEditingExisting && renderEditor()}

      {checks.length === 0 && <p class="empty">No checks yet — add one to get started.</p>}

      {groupChecks(checks).map((g) => {
        const cards = g.checks.map(renderCard);
        if (g.name === '') return <div key="__ungrouped">{cards}</div>;

        const outcomes = g.checks
          .filter((c) => c.enabled)
          .map<Outcome>((c) => (running.has(c.id) ? 'pending' : results[c.id]?.outcome ?? 'pending'));
        const agg = aggregateOutcome(outcomes);
        const isCollapsed = collapsed.has(g.name);
        const gHint = dropHint?.key === `g:${g.name}` ? dropHint.pos : null;
        const containerDropCls = gHint && gHint !== 'into' ? `drop-${gHint}` : '';
        const headerDropCls = dropHint?.key === `gi:${g.name}` ? 'drop-into' : '';
        const draggingCls = drag?.type === 'group' && drag.key === `g:${g.name}` ? 'dragging' : '';
        return (
          <div
            class={`check-group ${draggingCls} ${containerDropCls}`}
            key={g.name}
            onDragOver={onGroupDragOver(g.name)}
            onDrop={onGroupDrop(g.name)}
          >
            <div
              class={`group-header ${headerDropCls}`}
              draggable
              onDragStart={(e) => startDrag(e, 'group', `g:${g.name}`)}
              onDragEnd={endDrag}
              onClick={() => toggleCollapse(g.name)}
              onDragOver={onHeaderDragOver(g.name)}
              onDrop={onHeaderDrop(g.name)}
            >
              <span class="grip" title="Drag to reorder group">
                ⠿
              </span>
              <span class={`status-dot dot-${agg}`} title={OUTCOME_LABEL[agg]} />
              <span class="group-caret">{isCollapsed ? '▸' : '▾'}</span>
              <span class="group-name">{g.name}</span>
              <span class="note">{g.checks.length === 1 ? '1 check' : `${g.checks.length} checks`}</span>
            </div>
            {!isCollapsed && cards}
          </div>
        );
      })}
    </div>
  );
}

// ---------- editor panel ----------

function Editor({
  draft,
  setDraft,
  onSave,
  groupNames,
}: {
  draft: Draft;
  setDraft: (d: Draft | null) => void;
  onSave: () => void;
  groupNames: string[];
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
              const carry = { id: draft.id, name: draft.name, group: draft.group };
              setDraft(kind === 'js' ? { ...emptyJsDraft(), ...carry } : { ...emptyHttpDraft(), ...carry });
            }}
          >
            <option value="http">HTTP (form / curl)</option>
            <option value="js">Async JS function</option>
          </Select>
        </Field>
        <Field label="Name">
          <Input value={draft.name} onInput={(e) => set({ name: (e.target as HTMLInputElement).value })} />
        </Field>
        <Field label="Group (optional)">
          <Input
            value={draft.group}
            list="health-groups"
            placeholder="e.g. Production"
            onInput={(e) => set({ group: (e.target as HTMLInputElement).value })}
          />
          <datalist id="health-groups">
            {groupNames.map((g) => (
              <option value={g} />
            ))}
          </datalist>
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
