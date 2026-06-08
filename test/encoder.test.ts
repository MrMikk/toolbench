import { describe, it, expect } from 'vitest';
import { runEncoder } from '../src/apps/encoder/logic';

describe('encoder', () => {
  it('URL encode/decode round-trips', () => {
    const s = 'a b&c=d/?#';
    expect(runEncoder('url-decode', runEncoder('url-encode', s))).toBe(s);
  });

  it('Base64 encode/decode round-trips including unicode', () => {
    const s = 'héllo · 世界 🚀';
    const encoded = runEncoder('base64-encode', s);
    expect(runEncoder('base64-decode', encoded)).toBe(s);
  });

  it('HTML encode escapes special characters', () => {
    expect(runEncoder('html-encode', `<a href="x">'&'</a>`)).toBe(
      '&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;',
    );
  });

  it('HTML decode handles named, decimal, and hex entities', () => {
    expect(runEncoder('html-decode', '&lt;b&gt;&#39;&#x41;&amp;')).toBe("<b>'A&");
  });

  it('throws on invalid Base64 input', () => {
    expect(() => runEncoder('base64-decode', '@@@not-base64@@@')).toThrow();
  });

  it('throws on malformed percent-encoding', () => {
    expect(() => runEncoder('url-decode', '%E0%A4%A')).toThrow();
  });
});
