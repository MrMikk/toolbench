import { describe, it, expect } from 'vitest';
import {
  beautify,
  detectLang,
  highlightFor,
  isMinifiable,
  minifyDoc,
  process,
  resolveLang,
} from '../src/apps/formatter/logic';

describe('formatter: detection & language helpers', () => {
  it('auto-detects JSON and XML, and gives up on others', () => {
    expect(detectLang('{"a":1}')).toBe('json');
    expect(detectLang('  [1,2,3] ')).toBe('json');
    expect(detectLang('<a><b/></a>')).toBe('xml');
    expect(detectLang('const x = 1')).toBeNull();
    expect(detectLang('')).toBeNull();
  });

  it('resolveLang honours an explicit choice and throws on undetectable auto', () => {
    expect(resolveLang('css', 'whatever')).toBe('css');
    expect(resolveLang('auto', '{"a":1}')).toBe('json');
    expect(() => resolveLang('auto', 'const x = 1')).toThrow();
  });

  it('maps languages to a highlight grammar', () => {
    expect(highlightFor('json')).toBe('json');
    expect(highlightFor('ts')).toBe('javascript');
    expect(highlightFor('html')).toBe('markup');
    expect(highlightFor('sql')).toBe('none');
  });

  it('only marks JSON and XML as minifiable', () => {
    expect(isMinifiable('json')).toBe(true);
    expect(isMinifiable('xml')).toBe(true);
    expect(isMinifiable('css')).toBe(false);
  });
});

describe('formatter: JSON & XML (dependency-free path)', () => {
  it('beautifies JSON with the chosen indent', async () => {
    expect(await beautify('{"a":1,"b":[2,3]}', 'json', '  ')).toBe(
      '{\n  "a": 1,\n  "b": [\n    2,\n    3\n  ]\n}',
    );
  });

  it('beautifies XML with nesting', async () => {
    expect(await beautify('<a><b>x</b></a>', 'xml', '  ')).toBe('<a>\n  <b>\n    x\n  </b>\n</a>');
  });

  it('minifies JSON and XML', () => {
    expect(minifyDoc('{ "a": 1 }', 'json')).toBe('{"a":1}');
    expect(minifyDoc('<a>\n  <b/>\n</a>', 'xml')).toBe('<a><b/></a>');
  });

  it('refuses to minify non JSON/XML languages', () => {
    expect(() => minifyDoc('a {}', 'css')).toThrow(/JSON and XML/);
  });

  it('throws on malformed JSON and mismatched XML', async () => {
    await expect(beautify('{bad', 'json', '  ')).rejects.toThrow();
    await expect(beautify('<a></b>', 'xml', '  ')).rejects.toThrow();
  });

  it('process routes auto-detected input through the right path', async () => {
    const r = await process('{"a":1}', 'auto', 'minify', '  ');
    expect(r).toEqual({ lang: 'json', output: '{"a":1}' });
  });
});
