import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import type { AppProps } from '../../sdk';
import { Button, Field, TextArea, Toolbar } from '../../ui';
import { diffLines } from './logic';

const STORAGE_KEY = 'state';
const SIGN: Record<string, string> = { add: '+', del: '-', eq: ' ' };

interface SavedState {
  a: string;
  b: string;
}

export default function DiffApp({ ctx }: AppProps) {
  const [a, setA] = useState('');
  const [b, setB] = useState('');
  const loaded = useRef(false);

  useEffect(() => {
    ctx.storage.get<SavedState>(STORAGE_KEY).then((saved) => {
      if (saved) {
        if (typeof saved.a === 'string') setA(saved.a);
        if (typeof saved.b === 'string') setB(saved.b);
      }
      loaded.current = true;
    });
  }, [ctx]);

  useEffect(() => {
    if (!loaded.current) return;
    void ctx.storage.set<SavedState>(STORAGE_KEY, { a, b });
  }, [ctx, a, b]);

  useEffect(() => {
    ctx.registerCommands([
      {
        id: 'diff:swap',
        title: 'Diff: Swap sides',
        run: () =>
          setA((prevA) => {
            setB(prevA);
            return b;
          }),
      },
    ]);
  }, [ctx, b]);

  const result = useMemo(() => (a || b ? diffLines(a, b) : null), [a, b]);

  return (
    <div class="stack">
      <div class="io-grid">
        <Field label="Original">
          <TextArea
            value={a}
            placeholder="Paste the original…"
            onInput={(e) => setA((e.target as HTMLTextAreaElement).value)}
          />
        </Field>
        <Field label="Changed">
          <TextArea
            value={b}
            placeholder="Paste the changed version…"
            onInput={(e) => setB((e.target as HTMLTextAreaElement).value)}
          />
        </Field>
      </div>

      {result && (
        <>
          <Toolbar>
            <span class="badge badge-pass">+{result.added} added</span>
            <span class="badge badge-fail">−{result.removed} removed</span>
          </Toolbar>
          <div class="diff">
            {result.rows.map((row, idx) => (
              <div class={`diff-line ${row.type}`} data-sign={SIGN[row.type]} key={idx}>
                {row.text || ' '}
              </div>
            ))}
          </div>
        </>
      )}

      <Toolbar>
        <Button
          onClick={() => {
            setA('');
            setB('');
          }}
          disabled={!a && !b}
        >
          Clear both
        </Button>
      </Toolbar>
    </div>
  );
}
