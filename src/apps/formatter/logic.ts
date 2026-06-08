export type Format = 'json' | 'xml';
export type FormatChoice = 'auto' | Format;
export type Action = 'beautify' | 'minify';

export interface IndentOption {
  id: string;
  label: string;
  /** The actual indent unit; size is ignored for tabs. */
  unit: string;
}

export const INDENT_OPTIONS: readonly IndentOption[] = [
  { id: '2', label: '2 spaces', unit: '  ' },
  { id: '4', label: '4 spaces', unit: '    ' },
  { id: 'tab', label: 'Tabs', unit: '\t' },
];

/** Best-effort detection of the input format. Returns null when unrecognised. */
export function detectFormat(input: string): Format | null {
  const t = input.trim();
  if (!t) return null;
  if (t.startsWith('<')) return 'xml';
  if (t.startsWith('{') || t.startsWith('[')) return 'json';
  try {
    JSON.parse(t);
    return 'json';
  } catch {
    return null;
  }
}

// --- JSON ---
function formatJson(input: string, indent: string): string {
  return JSON.stringify(JSON.parse(input), null, indent);
}
function minifyJson(input: string): string {
  return JSON.stringify(JSON.parse(input));
}

// --- XML ---
function tagName(token: string): string {
  const m = token.match(/^<\/?\s*([^\s/>]+)/);
  return m ? m[1] : '';
}

function tokenizeXml(src: string): string[] {
  const tokens: string[] = [];
  const re = /<[^>]+>|[^<]+/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src.trim()))) {
    const tok = m[0].trim();
    if (tok) tokens.push(tok);
  }
  return tokens;
}

function formatXml(input: string, indent: string): string {
  const tokens = tokenizeXml(input);
  const stack: string[] = [];
  const lines: string[] = [];
  let depth = 0;
  const pad = (n: number) => indent.repeat(Math.max(0, n));

  for (const tok of tokens) {
    if (!tok.startsWith('<')) {
      lines.push(pad(depth) + tok);
      continue;
    }
    const isClosing = /^<\//.test(tok);
    const isSelfClosing = /\/>$/.test(tok);
    const isDecl = /^<[?!]/.test(tok); // <?xml?>, <!-- -->, <!DOCTYPE>

    if (isClosing) {
      const opened = stack.pop();
      if (opened !== tagName(tok)) {
        throw new Error(`Mismatched closing tag </${tagName(tok)}>`);
      }
      depth--;
      lines.push(pad(depth) + tok);
    } else if (isSelfClosing || isDecl) {
      lines.push(pad(depth) + tok);
    } else {
      lines.push(pad(depth) + tok);
      stack.push(tagName(tok));
      depth++;
    }
  }

  if (stack.length) throw new Error(`Unclosed tag <${stack[stack.length - 1]}>`);
  return lines.join('\n');
}

function minifyXml(input: string): string {
  // Validate by round-tripping through the formatter, then collapse whitespace.
  formatXml(input, '  ');
  return input.trim().replace(/>\s+</g, '><');
}

export interface FormatResult {
  format: Format;
  output: string;
}

/**
 * Format or minify `input`. When `choice` is 'auto' the format is detected.
 * Throws on unrecognised or malformed input.
 */
export function process(
  input: string,
  choice: FormatChoice,
  action: Action,
  indent: string,
): FormatResult {
  const format = choice === 'auto' ? detectFormat(input) : choice;
  if (!format) throw new Error('Could not detect the format. Choose one explicitly.');

  if (format === 'json') {
    return { format, output: action === 'minify' ? minifyJson(input) : formatJson(input, indent) };
  }
  return { format, output: action === 'minify' ? minifyXml(input) : formatXml(input, indent) };
}
