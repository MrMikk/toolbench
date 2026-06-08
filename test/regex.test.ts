import { describe, it, expect } from 'vitest';
import { replacePreview, runRegex } from '../src/apps/regex/logic';

describe('regex tester', () => {
  it('finds all matches when global', () => {
    const r = runRegex('a', 'g', 'banana');
    expect(r.ok).toBe(true);
    expect(r.matches).toHaveLength(3);
    expect(r.matches[0].index).toBe(1);
  });

  it('returns only the first match without the global flag', () => {
    expect(runRegex('a', '', 'banana').matches).toHaveLength(1);
  });

  it('captures positional and named groups', () => {
    const r = runRegex('(?<y>\\d{4})-(\\d{2})', '', '2018-01');
    expect(r.matches[0].groups).toEqual(['2018', '01']);
    expect(r.matches[0].named.y).toBe('2018');
  });

  it('reports invalid patterns instead of throwing', () => {
    const r = runRegex('(', '', 'x');
    expect(r.ok).toBe(false);
    expect(r.error).toBeTruthy();
  });

  it('does not hang on zero-length global matches', () => {
    const r = runRegex('a*', 'g', 'bbb');
    expect(r.ok).toBe(true);
    expect(r.matches.length).toBeLessThan(10);
  });

  it('previews replacements with group references', () => {
    expect(replacePreview('(\\w+)@(\\w+)', 'g', 'me@host', '$2.$1').output).toBe('host.me');
  });
});
