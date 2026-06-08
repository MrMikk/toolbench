import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import type { AppProps } from '../../sdk';
import { CopyButton, Field, Input, Select, Toolbar } from '../../ui';
import { parseNumber, toBases, type Radix } from './logic';

const STORAGE_KEY = 'state';

interface SavedState {
  input: string;
  radix: string;
}

const RADIX_OPTIONS = [
  { id: 'auto', label: 'Auto-detect' },
  { id: '2', label: 'Binary' },
  { id: '8', label: 'Octal' },
  { id: '10', label: 'Decimal' },
  { id: '16', label: 'Hex' },
];

const ROWS: { key: keyof ReturnType<typeof toBases>; label: string }[] = [
  { key: 'bin', label: 'Binary' },
  { key: 'oct', label: 'Octal' },
  { key: 'dec', label: 'Decimal' },
  { key: 'hex', label: 'Hex' },
];

export default function BaseApp({ ctx }: AppProps) {
  const [input, setInput] = useState('');
  const [radix, setRadix] = useState('auto');
  const loaded = useRef(false);

  useEffect(() => {
    ctx.storage.get<SavedState>(STORAGE_KEY).then((saved) => {
      if (saved) {
        if (typeof saved.input === 'string') setInput(saved.input);
        if (typeof saved.radix === 'string') setRadix(saved.radix);
      }
      loaded.current = true;
    });
  }, [ctx]);

  useEffect(() => {
    if (!loaded.current) return;
    void ctx.storage.set<SavedState>(STORAGE_KEY, { input, radix });
  }, [ctx, input, radix]);

  const result = useMemo(() => {
    if (!input.trim()) return null;
    try {
      const value = parseNumber(input, radix === 'auto' ? undefined : (Number(radix) as Radix));
      return { ok: true as const, bases: toBases(value) };
    } catch (e) {
      return { ok: false as const, error: e instanceof Error ? e.message : 'Invalid number' };
    }
  }, [input, radix]);

  return (
    <div class="stack">
      <Toolbar>
        <Field label="Number">
          <Input
            value={input}
            class={result && !result.ok ? 'has-error' : ''}
            placeholder="255, 0xff, 0b1010, 0o777…"
            onInput={(e) => setInput((e.target as HTMLInputElement).value)}
          />
        </Field>
        <Field label="Input base">
          <Select value={radix} onInput={(e) => setRadix((e.target as HTMLSelectElement).value)}>
            {RADIX_OPTIONS.map((o) => (
              <option value={o.id}>{o.label}</option>
            ))}
          </Select>
        </Field>
      </Toolbar>

      {result && !result.ok && <p class="error-text">{result.error}</p>}

      {result?.ok && (
        <div class="kv-table">
          {ROWS.map((r) => (
            <div class="kv-row" key={r.key}>
              <span class="kv-label">{r.label}</span>
              <span class="kv-value">{result.bases[r.key]}</span>
              <CopyButton variant="ghost" value={result.bases[r.key]} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
