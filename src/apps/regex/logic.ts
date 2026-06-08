export interface RegexMatch {
  match: string;
  index: number;
  groups: string[];
  named: Record<string, string>;
}

export interface RegexResult {
  ok: boolean;
  error?: string;
  matches: RegexMatch[];
}

export const REGEX_FLAGS: { flag: string; label: string }[] = [
  { flag: 'g', label: 'global' },
  { flag: 'i', label: 'ignore case' },
  { flag: 'm', label: 'multiline' },
  { flag: 's', label: 'dotall' },
  { flag: 'u', label: 'unicode' },
  { flag: 'y', label: 'sticky' },
];

function toMatch(m: RegExpExecArray): RegexMatch {
  return {
    match: m[0],
    index: m.index,
    groups: m.slice(1).map((g) => g ?? ''),
    named: m.groups
      ? Object.fromEntries(Object.entries(m.groups).map(([k, v]) => [k, v ?? '']))
      : {},
  };
}

/** Run a pattern against text, returning every match (or the first if not global). */
export function runRegex(pattern: string, flags: string, text: string): RegexResult {
  if (!pattern) return { ok: true, matches: [] };

  let re: RegExp;
  try {
    re = new RegExp(pattern, flags);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Invalid pattern', matches: [] };
  }

  const matches: RegexMatch[] = [];
  if (re.global || re.sticky) {
    let m: RegExpExecArray | null;
    let guard = 0;
    while ((m = re.exec(text)) !== null) {
      matches.push(toMatch(m));
      if (m.index === re.lastIndex) re.lastIndex++; // avoid looping on zero-length matches
      if (++guard > 100_000) break;
    }
  } else {
    const m = re.exec(text);
    if (m) matches.push(toMatch(m));
  }
  return { ok: true, matches };
}

export interface ReplaceResult {
  ok: boolean;
  error?: string;
  output: string;
}

/** Preview a `String.replace` using the pattern and replacement template. */
export function replacePreview(
  pattern: string,
  flags: string,
  text: string,
  replacement: string,
): ReplaceResult {
  try {
    return { ok: true, output: text.replace(new RegExp(pattern, flags), replacement) };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Invalid pattern', output: '' };
  }
}
