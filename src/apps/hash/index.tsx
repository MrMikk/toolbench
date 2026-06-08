import { useEffect, useRef, useState } from 'preact/hooks';
import type { AppProps } from '../../sdk';
import { Checkbox, CopyButton, Field, Input, Select, TextArea, Toolbar } from '../../ui';
import { computeHash, HASH_ALGOS, type HashAlgo } from './logic';

const STORAGE_KEY = 'state';

interface SavedState {
  algo: HashAlgo;
  input: string;
  key: string;
  upper: boolean;
}

export default function HashApp({ ctx }: AppProps) {
  const [algo, setAlgo] = useState<HashAlgo>('SHA-256');
  const [input, setInput] = useState('');
  const [key, setKey] = useState('');
  const [upper, setUpper] = useState(false);
  const [output, setOutput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const loaded = useRef(false);

  useEffect(() => {
    ctx.storage.get<SavedState>(STORAGE_KEY).then((saved) => {
      if (saved) {
        if (saved.algo) setAlgo(saved.algo);
        if (typeof saved.input === 'string') setInput(saved.input);
        if (typeof saved.key === 'string') setKey(saved.key);
        if (typeof saved.upper === 'boolean') setUpper(saved.upper);
      }
      loaded.current = true;
    });
  }, [ctx]);

  useEffect(() => {
    if (!loaded.current) return;
    void ctx.storage.set<SavedState>(STORAGE_KEY, { algo, input, key, upper });
  }, [ctx, algo, input, key, upper]);

  useEffect(() => {
    ctx.registerCommands(
      HASH_ALGOS.map((a) => ({
        id: `hash:${a}`,
        title: `Hash: ${a}`,
        run: () => setAlgo(a),
      })),
    );
  }, [ctx]);

  // Hashing is async; recompute whenever an input changes.
  useEffect(() => {
    let active = true;
    if (!input) {
      setOutput('');
      setError(null);
      return;
    }
    computeHash(algo, input, key)
      .then((hex) => {
        if (active) {
          setOutput(hex);
          setError(null);
        }
      })
      .catch((e) => {
        if (active) setError(e instanceof Error ? e.message : 'Hashing failed');
      });
    return () => {
      active = false;
    };
  }, [algo, input, key]);

  const shown = upper ? output.toUpperCase() : output;

  return (
    <div class="stack">
      <Toolbar>
        <Field label="Algorithm">
          <Select value={algo} onInput={(e) => setAlgo((e.target as HTMLSelectElement).value as HashAlgo)}>
            {HASH_ALGOS.map((a) => (
              <option value={a}>{a}</option>
            ))}
          </Select>
        </Field>
        <Field label="HMAC key (optional)">
          <Input
            value={key}
            placeholder="Leave empty for a plain digest"
            onInput={(e) => setKey((e.target as HTMLInputElement).value)}
          />
        </Field>
      </Toolbar>

      <Field label="Input">
        <TextArea
          value={input}
          placeholder="Type or paste text…"
          onInput={(e) => setInput((e.target as HTMLTextAreaElement).value)}
        />
      </Field>

      <Field label={key ? `${algo} · HMAC` : `${algo} · digest`}>
        <TextArea readOnly class={error ? 'has-error' : ''} value={error ?? shown} placeholder="Hash…" />
      </Field>

      <Toolbar>
        <CopyButton variant="primary" label="Copy hash" value={shown} />
        <Checkbox label="Uppercase" checked={upper} onChange={(e) => setUpper((e.target as HTMLInputElement).checked)} />
      </Toolbar>
    </div>
  );
}
