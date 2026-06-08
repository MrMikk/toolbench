import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import type { AppProps } from '../../sdk';
import { Button, CopyButton, Field, Input, Toolbar } from '../../ui';
import { describe, parseInput } from './logic';

const STORAGE_KEY = 'input';

export default function TimeApp({ ctx }: AppProps) {
  const [input, setInput] = useState('');
  const loaded = useRef(false);

  useEffect(() => {
    ctx.storage.get<string>(STORAGE_KEY).then((saved) => {
      setInput(typeof saved === 'string' && saved ? saved : String(Math.floor(Date.now() / 1000)));
      loaded.current = true;
    });
  }, [ctx]);

  useEffect(() => {
    if (!loaded.current) return;
    void ctx.storage.set<string>(STORAGE_KEY, input);
  }, [ctx, input]);

  useEffect(() => {
    ctx.registerCommands([
      {
        id: 'time:now',
        title: 'Timestamp: Use now',
        run: () => setInput(String(Math.floor(Date.now() / 1000))),
      },
    ]);
  }, [ctx]);

  const result = useMemo(() => {
    if (!input.trim()) return null;
    try {
      return { ok: true as const, rows: describe(parseInput(input)) };
    } catch (e) {
      return { ok: false as const, error: e instanceof Error ? e.message : 'Invalid input' };
    }
  }, [input]);

  return (
    <div class="stack">
      <Toolbar>
        <Field label="Unix timestamp or date">
          <Input
            value={input}
            class={result && !result.ok ? 'has-error' : ''}
            placeholder="1516239022, 2018-01-18T01:30:22Z…"
            onInput={(e) => setInput((e.target as HTMLInputElement).value)}
          />
        </Field>
        <Button onClick={() => setInput(String(Math.floor(Date.now() / 1000)))}>Now</Button>
      </Toolbar>

      {result && !result.ok && <p class="error-text">{result.error}</p>}

      {result?.ok && (
        <div class="kv-table">
          {result.rows.map((r) => (
            <div class="kv-row" key={r.label}>
              <span class="kv-label">{r.label}</span>
              <span class="kv-value">{r.value}</span>
              <CopyButton variant="ghost" value={r.value} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
