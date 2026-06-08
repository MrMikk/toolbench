import { describe, it, expect } from 'vitest';
import { convert, csvToJson, jsonToCsv, parseCsv } from '../src/apps/convert/logic';

describe('json ⇄ csv converter', () => {
  it('serialises an array of objects to CSV', () => {
    expect(jsonToCsv('[{"a":1,"b":2},{"a":3,"b":4}]')).toBe('a,b\n1,2\n3,4');
  });

  it('unions keys across rows', () => {
    expect(jsonToCsv('[{"a":1},{"b":2}]')).toBe('a,b\n1,\n,2');
  });

  it('quotes fields containing commas, quotes or newlines', () => {
    expect(jsonToCsv('[{"a":"x,y"},{"a":"he \\"said\\""}]')).toBe('a\n"x,y"\n"he ""said"""');
  });

  it('parses quoted CSV cells including embedded delimiters', () => {
    expect(parseCsv('a,b\n"x,y","z\nw"')).toEqual([
      ['a', 'b'],
      ['x,y', 'z\nw'],
    ]);
  });

  it('round-trips CSV → JSON → CSV', () => {
    const csv = 'name,year\nAda,1815\nGrace,1906';
    const json = csvToJson(csv);
    expect(JSON.parse(json)).toEqual([
      { name: 'Ada', year: '1815' },
      { name: 'Grace', year: '1906' },
    ]);
    expect(jsonToCsv(json)).toBe(csv);
  });

  it('auto-detects direction', () => {
    expect(convert('[{"a":1}]', 'auto')).toBe('a\n1');
    expect(convert('a\n1', 'auto')).toBe('[\n  {\n    "a": "1"\n  }\n]');
  });

  it('throws on invalid JSON', () => {
    expect(() => jsonToCsv('{not json}')).toThrow();
  });
});
