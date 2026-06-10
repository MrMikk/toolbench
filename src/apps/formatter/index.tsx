import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import type { AppProps } from '../../sdk';
import { Button, CopyButton, Field, Select, Toolbar } from '../../ui';
import { CodeEditor } from '../../ui/code';
import {
  INDENT_OPTIONS,
  LANGS,
  detectLang,
  highlightFor,
  isMinifiable,
  process,
  resolveLang,
  type Action,
  type FormatChoice,
} from './logic';

const STORAGE_KEY = 'state';

interface SavedState {
  choice: FormatChoice;
  indent: string;
  input: string;
}

export default function FormatterApp({ ctx }: AppProps) {
  const [choice, setChoice] = useState<FormatChoice>('auto');
  const [indentId, setIndentId] = useState('2');
  const [input, setInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const loaded = useRef(false);

  useEffect(() => {
    ctx.storage.get<SavedState>(STORAGE_KEY).then((saved) => {
      if (saved) {
        if (saved.choice) setChoice(saved.choice);
        if (saved.indent) setIndentId(saved.indent);
        if (typeof saved.input === 'string') setInput(saved.input);
      }
      loaded.current = true;
    });
  }, [ctx]);

  useEffect(() => {
    if (!loaded.current) return;
    void ctx.storage.set<SavedState>(STORAGE_KEY, { choice, indent: indentId, input });
  }, [ctx, choice, indentId, input]);

  useEffect(() => {
    ctx.registerCommands([
      { id: 'formatter:auto', title: 'Formatter: Auto-detect', run: () => setChoice('auto') },
      ...LANGS.map((l) => ({
        id: `formatter:${l.id}`,
        title: `Formatter: ${l.label}`,
        run: () => setChoice(l.id),
      })),
    ]);
  }, [ctx]);

  const indentUnit = INDENT_OPTIONS.find((o) => o.id === indentId)?.unit ?? '  ';
  const detected = useMemo(() => (input.trim() ? detectLang(input) : null), [input]);
  const effective = choice === 'auto' ? detected : choice;
  const language = effective ? highlightFor(effective) : 'none';
  const canMinify = effective != null && isMinifiable(effective);

  const run = async (action: Action) => {
    setBusy(true);
    try {
      // Resolve eagerly so an undetectable 'auto' fails before we spin up a formatter.
      resolveLang(choice, input);
      const { output } = await process(input, choice, action, indentUnit);
      setInput(output);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Invalid input');
    } finally {
      setBusy(false);
    }
  };

  // Clear the error as soon as the input or chosen format changes.
  useEffect(() => setError(null), [input, choice]);

  return (
    <div class="stack">
      <Toolbar>
        <Field label="Language">
          <Select
            value={choice}
            onInput={(e) => setChoice((e.target as HTMLSelectElement).value as FormatChoice)}
          >
            <option value="auto">
              Auto-detect{detected ? ` (${detected.toUpperCase()})` : ''}
            </option>
            {LANGS.map((l) => (
              <option value={l.id}>{l.label}</option>
            ))}
          </Select>
        </Field>
        <Field label="Indent">
          <Select value={indentId} onInput={(e) => setIndentId((e.target as HTMLSelectElement).value)}>
            {INDENT_OPTIONS.map((o) => (
              <option value={o.id}>{o.label}</option>
            ))}
          </Select>
        </Field>
      </Toolbar>

      <Field label="Document">
        <CodeEditor
          class={`fill ${error ? 'has-error' : ''}`}
          language={language}
          value={input}
          placeholder="Paste code or markup…"
          onInput={(e) => setInput(e.currentTarget.value)}
        />
      </Field>
      {error && <p class="error-text">{error}</p>}

      <Toolbar>
        <Button variant="primary" onClick={() => void run('beautify')} disabled={!input.trim() || busy}>
          {busy ? 'Formatting…' : 'Beautify'}
        </Button>
        <Button
          onClick={() => void run('minify')}
          disabled={!input.trim() || busy || !canMinify}
          title={canMinify ? undefined : 'Minify is available for JSON and XML only'}
        >
          Minify
        </Button>
        <CopyButton value={input} />
        <Button onClick={() => setInput('')} disabled={!input}>
          Clear
        </Button>
      </Toolbar>
    </div>
  );
}
