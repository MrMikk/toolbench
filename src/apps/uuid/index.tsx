import { useEffect, useRef, useState } from 'preact/hooks';
import type { AppProps } from '../../sdk';
import { Button, CopyButton, Field, Input, Select, Toolbar } from '../../ui';
import { generate, TOKEN_KINDS, type TokenKind } from './logic';

const STORAGE_KEY = 'state';

interface SavedState {
  kind: TokenKind;
  count: number;
}

export default function UuidApp({ ctx }: AppProps) {
  const [kind, setKind] = useState<TokenKind>('uuid');
  const [count, setCount] = useState(5);
  const [values, setValues] = useState<string[]>([]);
  const loaded = useRef(false);

  const run = (k: TokenKind, c: number) => setValues(generate(k, c));

  useEffect(() => {
    ctx.storage.get<SavedState>(STORAGE_KEY).then((saved) => {
      const k = saved?.kind ?? 'uuid';
      const c = saved?.count ?? 5;
      setKind(k);
      setCount(c);
      run(k, c);
      loaded.current = true;
    });
  }, [ctx]);

  useEffect(() => {
    if (!loaded.current) return;
    void ctx.storage.set<SavedState>(STORAGE_KEY, { kind, count });
  }, [ctx, kind, count]);

  useEffect(() => {
    ctx.registerCommands([
      { id: 'uuid:generate', title: 'UUID: Generate', run: () => run(kind, count) },
      ...TOKEN_KINDS.map((t) => ({
        id: `uuid:${t.id}`,
        title: `UUID: ${t.label}`,
        run: () => {
          setKind(t.id);
          run(t.id, count);
        },
      })),
    ]);
  }, [ctx, kind, count]);

  return (
    <div class="stack">
      <Toolbar>
        <Field label="Type">
          <Select
            value={kind}
            onInput={(e) => setKind((e.target as HTMLSelectElement).value as TokenKind)}
          >
            {TOKEN_KINDS.map((t) => (
              <option value={t.id}>{t.label}</option>
            ))}
          </Select>
        </Field>
        <Field label="How many">
          <Input
            type="number"
            min={1}
            max={100}
            value={count}
            onInput={(e) => setCount(Number((e.target as HTMLInputElement).value))}
          />
        </Field>
        <Button variant="primary" onClick={() => run(kind, count)}>
          Generate
        </Button>
      </Toolbar>

      <div class="token-list">
        {values.map((v, i) => (
          <div key={`${i}-${v}`}>
            <span>{v}</span>
            <CopyButton variant="ghost" value={v} />
          </div>
        ))}
      </div>

      {values.length > 1 && <CopyButton label="Copy all" value={values.join('\n')} />}
    </div>
  );
}
