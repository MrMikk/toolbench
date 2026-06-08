import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import type { AppProps } from '../../sdk';
import { Field, Input, Select, Toolbar } from '../../ui';
import { CRON_PRESETS, describe, nextRuns, parseCron } from './logic';

const STORAGE_KEY = 'expr';

export default function CronApp({ ctx }: AppProps) {
  const [expr, setExpr] = useState('');
  const loaded = useRef(false);

  useEffect(() => {
    ctx.storage.get<string>(STORAGE_KEY).then((saved) => {
      setExpr(typeof saved === 'string' && saved ? saved : '*/15 * * * *');
      loaded.current = true;
    });
  }, [ctx]);

  useEffect(() => {
    if (!loaded.current) return;
    void ctx.storage.set<string>(STORAGE_KEY, expr);
  }, [ctx, expr]);

  useEffect(() => {
    ctx.registerCommands(
      CRON_PRESETS.map((p) => ({
        id: `cron:${p.expr}`,
        title: `Cron: ${p.label}`,
        subtitle: p.expr,
        run: () => setExpr(p.expr),
      })),
    );
  }, [ctx]);

  const result = useMemo(() => {
    if (!expr.trim()) return null;
    try {
      const parts = parseCron(expr);
      return { ok: true as const, text: describe(parts), runs: nextRuns(parts) };
    } catch (e) {
      return { ok: false as const, error: e instanceof Error ? e.message : 'Invalid expression' };
    }
  }, [expr]);

  return (
    <div class="stack">
      <Toolbar>
        <Field label="Cron expression">
          <Input
            value={expr}
            class={result && !result.ok ? 'has-error' : ''}
            placeholder="*/15 * * * *"
            onInput={(e) => setExpr((e.target as HTMLInputElement).value)}
          />
        </Field>
        <Field label="Presets">
          <Select value="" onInput={(e) => setExpr((e.target as HTMLSelectElement).value)}>
            <option value="">Choose…</option>
            {CRON_PRESETS.map((p) => (
              <option value={p.expr}>{p.label}</option>
            ))}
          </Select>
        </Field>
      </Toolbar>

      {result && !result.ok && <p class="error-text">{result.error}</p>}

      {result?.ok && (
        <>
          <Field label="Meaning">
            <p class="note" style={{ fontSize: '1rem', color: 'var(--text)' }}>
              {result.text}
            </p>
          </Field>

          <Field label="Next runs (UTC)">
            <div class="token-list">
              {result.runs.map((d) => (
                <div key={d.getTime()}>
                  <span>{d.toISOString().replace('.000Z', 'Z')}</span>
                </div>
              ))}
            </div>
          </Field>
        </>
      )}

      <p class="note">Fields: minute · hour · day-of-month · month · day-of-week.</p>
    </div>
  );
}
