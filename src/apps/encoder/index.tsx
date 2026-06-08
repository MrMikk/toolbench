import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import type { AppProps } from '../../sdk';
import { Button, Field, Select, TextArea, Toolbar } from '../../ui';
import { ENCODER_OPS, runEncoder, type EncoderMode } from './logic';

const STORAGE_KEY = 'state';

interface SavedState {
  mode: EncoderMode;
  input: string;
}

export default function EncoderApp({ ctx }: AppProps) {
  const [mode, setMode] = useState<EncoderMode>('url-encode');
  const [input, setInput] = useState('');
  const [copied, setCopied] = useState(false);
  const loaded = useRef(false);

  // Restore the previous session.
  useEffect(() => {
    ctx.storage.get<SavedState>(STORAGE_KEY).then((saved) => {
      if (saved) {
        if (saved.mode) setMode(saved.mode);
        if (typeof saved.input === 'string') setInput(saved.input);
      }
      loaded.current = true;
    });
  }, [ctx]);

  // Persist, but only after the initial restore so we don't clobber it.
  useEffect(() => {
    if (!loaded.current) return;
    void ctx.storage.set<SavedState>(STORAGE_KEY, { mode, input });
  }, [ctx, mode, input]);

  // Contribute mode-switch commands to the spotlight while mounted.
  useEffect(() => {
    ctx.registerCommands(
      ENCODER_OPS.map((op) => ({
        id: `encoder:${op.id}`,
        title: `Encoder: ${op.label}`,
        keywords: op.group,
        run: () => setMode(op.id),
      })),
    );
  }, [ctx]);

  const result = useMemo(() => {
    if (!input) return { ok: true as const, value: '' };
    try {
      return { ok: true as const, value: runEncoder(mode, input) };
    } catch (e) {
      return { ok: false as const, error: e instanceof Error ? e.message : 'Invalid input' };
    }
  }, [mode, input]);

  const copy = async () => {
    if (!result.ok || !result.value) return;
    await navigator.clipboard.writeText(result.value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  };

  return (
    <div class="stack">
      <Toolbar>
        <Field label="Transform">
          <Select
            value={mode}
            onInput={(e) => setMode((e.target as HTMLSelectElement).value as EncoderMode)}
          >
            {ENCODER_OPS.map((op) => (
              <option value={op.id}>{op.label}</option>
            ))}
          </Select>
        </Field>
      </Toolbar>

      <div class="io-grid">
        <Field label="Input">
          <TextArea
            value={input}
            placeholder="Type or paste text…"
            onInput={(e) => setInput((e.target as HTMLTextAreaElement).value)}
          />
        </Field>
        <Field label="Output">
          <TextArea
            readOnly
            value={result.ok ? result.value : ''}
            class={result.ok ? '' : 'has-error'}
            placeholder="Result…"
          />
          {!result.ok && <p class="error-text">{result.error}</p>}
        </Field>
      </div>

      <Toolbar>
        <Button variant="primary" onClick={copy} disabled={!result.ok || !result.value}>
          {copied ? 'Copied!' : 'Copy output'}
        </Button>
        <Button onClick={() => setInput('')} disabled={!input}>
          Clear
        </Button>
      </Toolbar>
    </div>
  );
}
