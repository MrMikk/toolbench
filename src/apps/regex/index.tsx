import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import type { AppProps } from '../../sdk';
import { Checkbox, Field, Input, TextArea, Toolbar } from '../../ui';
import { REGEX_FLAGS, replacePreview, runRegex } from './logic';

const STORAGE_KEY = 'state';

interface SavedState {
  pattern: string;
  flags: string;
  text: string;
  replacement: string;
}

interface Segment {
  text: string;
  mark: boolean;
}

export default function RegexApp({ ctx }: AppProps) {
  const [pattern, setPattern] = useState('');
  const [flags, setFlags] = useState('g');
  const [text, setText] = useState('');
  const [replacement, setReplacement] = useState('');
  const loaded = useRef(false);

  useEffect(() => {
    ctx.storage.get<SavedState>(STORAGE_KEY).then((saved) => {
      if (saved) {
        if (typeof saved.pattern === 'string') setPattern(saved.pattern);
        if (typeof saved.flags === 'string') setFlags(saved.flags);
        if (typeof saved.text === 'string') setText(saved.text);
        if (typeof saved.replacement === 'string') setReplacement(saved.replacement);
      }
      loaded.current = true;
    });
  }, [ctx]);

  useEffect(() => {
    if (!loaded.current) return;
    void ctx.storage.set<SavedState>(STORAGE_KEY, { pattern, flags, text, replacement });
  }, [ctx, pattern, flags, text, replacement]);

  const toggleFlag = (flag: string) =>
    setFlags((f) => (f.includes(flag) ? f.replace(flag, '') : f + flag));

  const result = useMemo(() => runRegex(pattern, flags, text), [pattern, flags, text]);

  const segments = useMemo<Segment[]>(() => {
    if (!result.ok || result.matches.length === 0) return [{ text, mark: false }];
    const out: Segment[] = [];
    let pos = 0;
    for (const m of result.matches) {
      if (m.index > pos) out.push({ text: text.slice(pos, m.index), mark: false });
      out.push({ text: m.match, mark: true });
      pos = m.index + m.match.length;
    }
    if (pos < text.length) out.push({ text: text.slice(pos), mark: false });
    return out;
  }, [result, text]);

  const replaced = replacement ? replacePreview(pattern, flags, text, replacement) : null;

  return (
    <div class="stack">
      <Toolbar>
        <Field label="Pattern">
          <Input
            value={pattern}
            class={!result.ok ? 'has-error' : ''}
            placeholder="\b\w+@\w+\.\w+\b"
            onInput={(e) => setPattern((e.target as HTMLInputElement).value)}
          />
        </Field>
      </Toolbar>

      <Toolbar>
        {REGEX_FLAGS.map((f) => (
          <Checkbox
            key={f.flag}
            label={`${f.flag} · ${f.label}`}
            checked={flags.includes(f.flag)}
            onChange={() => toggleFlag(f.flag)}
          />
        ))}
      </Toolbar>

      {!result.ok && <p class="error-text">{result.error}</p>}

      <Field label="Test string">
        <TextArea
          value={text}
          placeholder="Text to match against…"
          onInput={(e) => setText((e.target as HTMLTextAreaElement).value)}
        />
      </Field>

      {text && (
        <Field label={`Matches (${result.matches.length})`}>
          <div class="match-preview">
            {segments.map((s, i) =>
              s.mark ? (
                <span class="match-mark" key={i}>
                  {s.text}
                </span>
              ) : (
                <span key={i}>{s.text}</span>
              ),
            )}
          </div>
        </Field>
      )}

      {result.matches.some((m) => m.groups.length > 0 || Object.keys(m.named).length > 0) && (
        <div class="kv-table">
          {result.matches.map((m, i) => (
            <div class="kv-row" key={i}>
              <span class="kv-label">#{i + 1} @ {m.index}</span>
              <span class="kv-value">
                {m.groups.map((g, gi) => `$${gi + 1}=${g}`).join('  ')}
                {Object.entries(m.named)
                  .map(([k, v]) => `  ${k}=${v}`)
                  .join('')}
              </span>
              <span />
            </div>
          ))}
        </div>
      )}

      <Field label="Replace with (optional)">
        <Input
          value={replacement}
          placeholder="$1, $<name>, literal text…"
          onInput={(e) => setReplacement((e.target as HTMLInputElement).value)}
        />
      </Field>

      {replaced?.ok && (
        <Field label="Replacement result">
          <TextArea readOnly value={replaced.output} />
        </Field>
      )}
    </div>
  );
}
