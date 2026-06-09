import type { JSX } from 'preact';
import { useRef } from 'preact/hooks';
import Prism from 'prismjs';
import 'prismjs/components/prism-json';
import 'prismjs/components/prism-markup';

export type Language = 'json' | 'markup' | 'jwt' | 'none';

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// A JWT is three dot-separated base64url segments; colour each one distinctly.
function highlightJwt(code: string): string {
  const classes = ['tok-jwt-header', 'tok-jwt-payload', 'tok-jwt-signature'];
  return code
    .split('.')
    .map((seg, i) => `<span class="${classes[Math.min(i, 2)]}">${escapeHtml(seg)}</span>`)
    .join('<span class="token punctuation">.</span>');
}

/** Highlight `code` to an HTML string for the given language. Falls back to escaped text. */
export function highlight(code: string, language: Language): string {
  if (language === 'jwt') return highlightJwt(code);
  const grammar = language !== 'none' ? Prism.languages[language] : undefined;
  return grammar ? Prism.highlight(code, grammar, language) : escapeHtml(code);
}

/** Read-only highlighted code block. */
export function CodeBlock({
  code,
  language,
  class: cls = '',
}: {
  code: string;
  language: Language;
  class?: string;
}) {
  return (
    <pre class={`code-block ${cls}`}>
      <code
        class={`language-${language}`}
        dangerouslySetInnerHTML={{ __html: highlight(code, language) }}
      />
    </pre>
  );
}

/** A textarea with a live, scroll-synced highlighted backdrop (highlight-as-you-type). */
export function CodeEditor({
  value,
  language,
  onInput,
  placeholder,
  readOnly,
  class: cls = '',
}: {
  value: string;
  language: Language;
  onInput?: JSX.GenericEventHandler<HTMLTextAreaElement>;
  placeholder?: string;
  readOnly?: boolean;
  class?: string;
}) {
  const preRef = useRef<HTMLPreElement>(null);

  const syncScroll = (e: JSX.TargetedUIEvent<HTMLTextAreaElement>) => {
    const ta = e.currentTarget;
    if (preRef.current) {
      preRef.current.scrollTop = ta.scrollTop;
      preRef.current.scrollLeft = ta.scrollLeft;
    }
  };

  return (
    <div class={`code-editor ${cls}`}>
      <pre ref={preRef} class="code-editor-pre" aria-hidden="true">
        {/* Trailing newline keeps the backdrop tall enough for the final line. */}
        <code
          class={`language-${language}`}
          dangerouslySetInnerHTML={{ __html: highlight(value, language) + '\n' }}
        />
      </pre>
      <textarea
        class="code-editor-area"
        value={value}
        placeholder={placeholder}
        spellcheck={false}
        readOnly={readOnly}
        onInput={onInput}
        onScroll={syncScroll}
      />
    </div>
  );
}
