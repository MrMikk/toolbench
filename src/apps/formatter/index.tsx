import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import type { AppProps } from '../../sdk';
import { Button, Field, Select, Toolbar } from '../../ui';
import { CodeEditor, type Language } from '../../ui/code';
import {
  INDENT_OPTIONS,
  detectFormat,
  process,
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
  const [copied, setCopied] = useState(false);
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
      { id: 'formatter:json', title: 'Formatter: JSON', run: () => setChoice('json') },
      { id: 'formatter:xml', title: 'Formatter: XML', run: () => setChoice('xml') },
    ]);
  }, [ctx]);

  const indentUnit = INDENT_OPTIONS.find((o) => o.id === indentId)?.unit ?? '  ';
  const detected = useMemo(() => (input.trim() ? detectFormat(input) : null), [input]);
  const language: Language = (choice === 'auto' ? detected : choice) === 'xml' ? 'markup' : 'json';

  const run = (action: Action) => {
    try {
      const { output } = process(input, choice, action, indentUnit);
      setInput(output);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Invalid input');
    }
  };

  // Clear the error as soon as the input or chosen format changes.
  useEffect(() => setError(null), [input, choice]);

  const copy = async () => {
    if (!input) return;
    await navigator.clipboard.writeText(input);
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  };

  return (
    <div class="stack">
      <Toolbar>
        <Field label="Format">
          <Select
            value={choice}
            onInput={(e) => setChoice((e.target as HTMLSelectElement).value as FormatChoice)}
          >
            <option value="auto">Auto-detect{detected ? ` (${detected.toUpperCase()})` : ''}</option>
            <option value="json">JSON</option>
            <option value="xml">XML</option>
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
          class={`tall ${error ? 'has-error' : ''}`}
          language={language}
          value={input}
          placeholder="Paste JSON or XML…"
          onInput={(e) => setInput(e.currentTarget.value)}
        />
      </Field>
      {error && <p class="error-text">{error}</p>}

      <Toolbar>
        <Button variant="primary" onClick={() => run('beautify')} disabled={!input.trim()}>
          Beautify
        </Button>
        <Button onClick={() => run('minify')} disabled={!input.trim()}>
          Minify
        </Button>
        <Button onClick={copy} disabled={!input}>
          {copied ? 'Copied!' : 'Copy'}
        </Button>
        <Button onClick={() => setInput('')} disabled={!input}>
          Clear
        </Button>
      </Toolbar>
    </div>
  );
}
