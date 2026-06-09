import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import type { AppProps } from '../../sdk';
import { CopyButton, Field, Select, Toolbar } from '../../ui';
import { CodeBlock, CodeEditor, type Language } from '../../ui/code';
import { convert, detect, type Direction } from './logic';

const STORAGE_KEY = 'state';

interface SavedState {
  input: string;
  direction: Direction;
}

const DIRECTIONS: { id: Direction; label: string }[] = [
  { id: 'auto', label: 'Auto-detect' },
  { id: 'json2csv', label: 'JSON → CSV' },
  { id: 'csv2json', label: 'CSV → JSON' },
];

export default function ConvertApp({ ctx }: AppProps) {
  const [input, setInput] = useState('');
  const [direction, setDirection] = useState<Direction>('auto');
  const loaded = useRef(false);

  useEffect(() => {
    ctx.storage.get<SavedState>(STORAGE_KEY).then((saved) => {
      if (saved) {
        if (typeof saved.input === 'string') setInput(saved.input);
        if (saved.direction) setDirection(saved.direction);
      }
      loaded.current = true;
    });
  }, [ctx]);

  useEffect(() => {
    if (!loaded.current) return;
    void ctx.storage.set<SavedState>(STORAGE_KEY, { input, direction });
  }, [ctx, input, direction]);

  useEffect(() => {
    ctx.registerCommands(
      DIRECTIONS.map((d) => ({
        id: `convert:${d.id}`,
        title: `Convert: ${d.label}`,
        run: () => setDirection(d.id),
      })),
    );
  }, [ctx]);

  const result = useMemo(() => {
    if (!input.trim()) return null;
    try {
      return { ok: true as const, output: convert(input, direction) };
    } catch (e) {
      return { ok: false as const, error: e instanceof Error ? e.message : 'Conversion failed' };
    }
  }, [input, direction]);

  const detected = input.trim() ? detect(input).toUpperCase() : null;
  const inputLang: Language = input.trim() && detect(input) === 'json' ? 'json' : 'none';
  const outputLang: Language =
    result?.ok && /^[[{]/.test(result.output.trim()) ? 'json' : 'none';

  return (
    <div class="stack">
      <Toolbar>
        <Field label="Direction">
          <Select
            value={direction}
            onInput={(e) => setDirection((e.target as HTMLSelectElement).value as Direction)}
          >
            {DIRECTIONS.map((d) => (
              <option value={d.id}>
                {d.id === 'auto' && detected ? `Auto-detect (${detected})` : d.label}
              </option>
            ))}
          </Select>
        </Field>
      </Toolbar>

      <div class="io-grid">
        <Field label="Input">
          <CodeEditor
            class="tall"
            language={inputLang}
            value={input}
            placeholder='[{"name":"Ada","year":1815}]  — or CSV with a header row'
            onInput={(e) => setInput(e.currentTarget.value)}
          />
        </Field>
        <Field label="Output">
          {result && !result.ok ? (
            <pre class="code-block tall has-error" style={{ color: 'var(--danger)' }}>
              {result.error}
            </pre>
          ) : (
            <CodeBlock class="tall" language={outputLang} code={result?.ok ? result.output : ''} />
          )}
        </Field>
      </div>

      <Toolbar>
        <CopyButton variant="primary" label="Copy output" value={result?.ok ? result.output : ''} />
      </Toolbar>
    </div>
  );
}
