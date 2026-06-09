import { describe, it, expect } from 'vitest';
import { highlight } from '../src/ui/code';

describe('syntax highlighting', () => {
  it('tokenizes JSON keys, strings and numbers', () => {
    const html = highlight('{"a":1,"b":"x"}', 'json');
    expect(html).toContain('token property');
    expect(html).toContain('token number');
    expect(html).toContain('token string');
  });

  it('tokenizes markup tags and attributes', () => {
    const html = highlight('<root attr="x"/>', 'markup');
    expect(html).toContain('token tag');
    expect(html).toContain('attr-name');
  });

  it('colours the three JWT segments distinctly', () => {
    const html = highlight('aaa.bbb.ccc', 'jwt');
    expect(html).toContain('tok-jwt-header');
    expect(html).toContain('tok-jwt-payload');
    expect(html).toContain('tok-jwt-signature');
  });

  it('escapes HTML when there is no grammar', () => {
    expect(highlight('<script>', 'none')).toBe('&lt;script&gt;');
  });
});
