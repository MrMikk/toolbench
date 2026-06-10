import type { Plugin } from 'prettier';
import type { Language } from '../../ui/code';

export type Action = 'beautify' | 'minify';

export type LangId =
  | 'json'
  | 'json5'
  | 'js'
  | 'jsx'
  | 'ts'
  | 'tsx'
  | 'css'
  | 'scss'
  | 'less'
  | 'html'
  | 'vue'
  | 'xml'
  | 'yaml'
  | 'markdown'
  | 'graphql'
  | 'sql';

export type FormatChoice = 'auto' | LangId;

export interface LangDef {
  id: LangId;
  label: string;
}

export const LANGS: readonly LangDef[] = [
  { id: 'json', label: 'JSON' },
  { id: 'json5', label: 'JSON5' },
  { id: 'js', label: 'JavaScript' },
  { id: 'jsx', label: 'JSX' },
  { id: 'ts', label: 'TypeScript' },
  { id: 'tsx', label: 'TSX' },
  { id: 'css', label: 'CSS' },
  { id: 'scss', label: 'SCSS' },
  { id: 'less', label: 'Less' },
  { id: 'html', label: 'HTML' },
  { id: 'vue', label: 'Vue' },
  { id: 'xml', label: 'XML' },
  { id: 'yaml', label: 'YAML' },
  { id: 'markdown', label: 'Markdown' },
  { id: 'graphql', label: 'GraphQL' },
  { id: 'sql', label: 'SQL' },
];

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

/** The CodeEditor highlight language to use for a given format. */
export function highlightFor(lang: LangId): Language {
  switch (lang) {
    case 'json':
    case 'json5':
      return 'json';
    case 'js':
    case 'jsx':
    case 'ts':
    case 'tsx':
      return 'javascript';
    case 'html':
    case 'vue':
    case 'xml':
      return 'markup';
    default:
      return 'none';
  }
}

const MINIFIABLE = new Set<LangId>(['json', 'xml']);
/** Minify is only meaningful where we can do it correctly. */
export const isMinifiable = (lang: LangId): boolean => MINIFIABLE.has(lang);

/** Best-effort detection of the input format. Only JSON and XML are auto-detected. */
export function detectLang(input: string): LangId | null {
  const t = input.trim();
  if (!t) return null;
  if (t.startsWith('<')) return 'xml';
  if (t.startsWith('{') || t.startsWith('[')) {
    try {
      JSON.parse(t);
    } catch {
      /* still most likely JSON */
    }
    return 'json';
  }
  try {
    JSON.parse(t);
    return 'json';
  } catch {
    return null;
  }
}

export function resolveLang(choice: FormatChoice, input: string): LangId {
  if (choice !== 'auto') return choice;
  const detected = detectLang(input);
  if (!detected) throw new Error('Could not auto-detect the language — choose one explicitly.');
  return detected;
}

// ---------- JSON (hand-rolled, dependency-free) ----------
function formatJson(input: string, indent: string): string {
  return JSON.stringify(JSON.parse(input), null, indent);
}
function minifyJson(input: string): string {
  return JSON.stringify(JSON.parse(input));
}

// ---------- XML (hand-rolled, dependency-free) ----------
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
    const isDecl = /^<[?!]/.test(tok);

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
  formatXml(input, '  '); // validate
  return input.trim().replace(/>\s+</g, '><');
}

// ---------- Prettier / SQL (loaded on demand) ----------
const indentOptions = (unit: string) =>
  unit === '\t' ? { useTabs: true, tabWidth: 2 } : { useTabs: false, tabWidth: unit.length };

const PRETTIER_PARSER: Partial<Record<LangId, string>> = {
  json5: 'json5',
  js: 'babel',
  jsx: 'babel',
  ts: 'typescript',
  tsx: 'typescript',
  css: 'css',
  scss: 'scss',
  less: 'less',
  html: 'html',
  vue: 'vue',
  yaml: 'yaml',
  markdown: 'markdown',
  graphql: 'graphql',
};

const asPlugin = (m: unknown) => m as unknown as Plugin;

async function pluginsFor(parser: string): Promise<Plugin[]> {
  switch (parser) {
    case 'babel':
    case 'json5':
      return [asPlugin(await import('prettier/plugins/babel')), asPlugin(await import('prettier/plugins/estree'))];
    case 'typescript':
      return [
        asPlugin(await import('prettier/plugins/typescript')),
        asPlugin(await import('prettier/plugins/estree')),
      ];
    case 'css':
    case 'scss':
    case 'less':
      return [asPlugin(await import('prettier/plugins/postcss'))];
    case 'html':
    case 'vue':
      return [asPlugin(await import('prettier/plugins/html'))];
    case 'yaml':
      return [asPlugin(await import('prettier/plugins/yaml'))];
    case 'markdown':
      return [asPlugin(await import('prettier/plugins/markdown'))];
    case 'graphql':
      return [asPlugin(await import('prettier/plugins/graphql'))];
    default:
      return [];
  }
}

/** Beautify input for the given language. JSON/XML are synchronous; others load a formatter. */
export async function beautify(input: string, lang: LangId, unit: string): Promise<string> {
  if (lang === 'json') return formatJson(input, unit);
  if (lang === 'xml') return formatXml(input, unit);
  if (lang === 'sql') {
    const { format } = await import('sql-formatter');
    return format(input, indentOptions(unit));
  }
  const parser = PRETTIER_PARSER[lang];
  if (!parser) throw new Error(`No formatter for ${lang}.`);
  const prettier = await import('prettier/standalone');
  const plugins = await pluginsFor(parser);
  const out = await prettier.format(input, { parser, plugins, ...indentOptions(unit) });
  return out.replace(/\n$/, '');
}

export function minifyDoc(input: string, lang: LangId): string {
  if (lang === 'json') return minifyJson(input);
  if (lang === 'xml') return minifyXml(input);
  throw new Error('Minify is only available for JSON and XML.');
}

export interface FormatResult {
  lang: LangId;
  output: string;
}

/** Format or minify `input`. When `choice` is 'auto' the language is detected. */
export async function process(
  input: string,
  choice: FormatChoice,
  action: Action,
  unit: string,
): Promise<FormatResult> {
  const lang = resolveLang(choice, input);
  const output = action === 'minify' ? minifyDoc(input, lang) : await beautify(input, lang, unit);
  return { lang, output };
}
