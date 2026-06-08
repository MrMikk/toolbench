/** Split a string into lowercase words across camelCase, snake_case, kebab and spaces. */
export function tokenize(input: string): string[] {
  return input
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .replace(/[_\-\s]+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean)
    .map((w) => w.toLowerCase());
}

const cap = (w: string) => (w ? w[0].toUpperCase() + w.slice(1) : w);

export const toCamel = (s: string) => tokenize(s).map((w, i) => (i === 0 ? w : cap(w))).join('');
export const toPascal = (s: string) => tokenize(s).map(cap).join('');
export const toSnake = (s: string) => tokenize(s).join('_');
export const toKebab = (s: string) => tokenize(s).join('-');
export const toConstant = (s: string) => tokenize(s).join('_').toUpperCase();
export const toTitle = (s: string) => tokenize(s).map(cap).join(' ');
export const toSentence = (s: string) => {
  const words = tokenize(s);
  return words.length ? cap(words[0]) + (words.length > 1 ? ' ' + words.slice(1).join(' ') : '') : '';
};
export const toSlug = (s: string) =>
  tokenize(s)
    .map((w) => w.replace(/[^a-z0-9]/g, ''))
    .filter(Boolean)
    .join('-');

export interface CaseRow {
  id: string;
  label: string;
  value: string;
}

export const CASES: { id: string; label: string; fn: (s: string) => string }[] = [
  { id: 'camel', label: 'camelCase', fn: toCamel },
  { id: 'pascal', label: 'PascalCase', fn: toPascal },
  { id: 'snake', label: 'snake_case', fn: toSnake },
  { id: 'kebab', label: 'kebab-case', fn: toKebab },
  { id: 'constant', label: 'CONSTANT_CASE', fn: toConstant },
  { id: 'title', label: 'Title Case', fn: toTitle },
  { id: 'sentence', label: 'Sentence case', fn: toSentence },
  { id: 'slug', label: 'url-slug', fn: toSlug },
];

export function convertAll(input: string): CaseRow[] {
  return CASES.map((c) => ({ id: c.id, label: c.label, value: c.fn(input) }));
}
