import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import type { AppProps } from '../../sdk';
import { CopyButton, Field, TextArea } from '../../ui';
import { convertAll } from './logic';

const STORAGE_KEY = 'input';

export default function CaseApp({ ctx }: AppProps) {
  const [input, setInput] = useState('');
  const loaded = useRef(false);

  useEffect(() => {
    ctx.storage.get<string>(STORAGE_KEY).then((saved) => {
      if (typeof saved === 'string') setInput(saved);
      loaded.current = true;
    });
  }, [ctx]);

  useEffect(() => {
    if (!loaded.current) return;
    void ctx.storage.set<string>(STORAGE_KEY, input);
  }, [ctx, input]);

  const rows = useMemo(() => convertAll(input), [input]);

  return (
    <div class="stack">
      <Field label="Input">
        <TextArea
          value={input}
          placeholder="Type any text or identifier…"
          onInput={(e) => setInput((e.target as HTMLTextAreaElement).value)}
        />
      </Field>

      <div class="kv-table">
        {rows.map((r) => (
          <div class="kv-row" key={r.id}>
            <span class="kv-label">{r.label}</span>
            <span class="kv-value">{r.value || '—'}</span>
            <CopyButton variant="ghost" value={r.value} />
          </div>
        ))}
      </div>
    </div>
  );
}
