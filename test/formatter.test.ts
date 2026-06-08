import { describe, it, expect } from 'vitest';
import { detectFormat, process } from '../src/apps/formatter/logic';

describe('detectFormat', () => {
  it('detects JSON objects, arrays, and bare values', () => {
    expect(detectFormat('{"a":1}')).toBe('json');
    expect(detectFormat('[1,2]')).toBe('json');
    expect(detectFormat('  42  ')).toBe('json');
  });

  it('detects XML', () => {
    expect(detectFormat('<root><a/></root>')).toBe('xml');
  });

  it('returns null for empty or unrecognised input', () => {
    expect(detectFormat('')).toBeNull();
    expect(detectFormat('just some prose')).toBeNull();
  });
});

describe('process — JSON', () => {
  it('beautifies with the chosen indent', () => {
    const out = process('{"a":1,"b":[2]}', 'auto', 'beautify', '  ').output;
    expect(out).toBe('{\n  "a": 1,\n  "b": [\n    2\n  ]\n}');
  });

  it('minifies', () => {
    expect(process('{\n  "a": 1\n}', 'json', 'minify', '  ').output).toBe('{"a":1}');
  });

  it('throws on invalid JSON', () => {
    expect(() => process('{bad}', 'json', 'beautify', '  ')).toThrow();
  });
});

describe('process — XML', () => {
  it('pretty-prints nested elements', () => {
    const out = process('<a><b>x</b></a>', 'xml', 'beautify', '  ').output;
    expect(out).toBe('<a>\n  <b>\n    x\n  </b>\n</a>');
  });

  it('throws on mismatched tags', () => {
    expect(() => process('<a></b>', 'xml', 'beautify', '  ')).toThrow(/mismatch/i);
  });

  it('throws on unclosed tags', () => {
    expect(() => process('<a><b></a>', 'xml', 'beautify', '  ')).toThrow();
  });

  it('minify collapses inter-tag whitespace', () => {
    expect(process('<a>\n  <b/>\n</a>', 'xml', 'minify', '  ').output).toBe('<a><b/></a>');
  });
});

describe('process — auto-detect failure', () => {
  it('throws a helpful error when the format is unknown', () => {
    expect(() => process('???', 'auto', 'beautify', '  ')).toThrow(/detect/i);
  });
});
