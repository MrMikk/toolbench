import { describe, it, expect } from 'vitest';
import { base64UrlDecode, decodeJwt, isExpired, timeClaims } from '../src/apps/jwt/logic';

// Standard example token (HS256, no exp): { sub, name, iat: 1516239022 }
const SAMPLE =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6Ik' +
  'pvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';

describe('jwt', () => {
  it('decodes header and payload', () => {
    const { header, payload, signature } = decodeJwt(SAMPLE);
    expect(header.alg).toBe('HS256');
    expect(payload.name).toBe('John Doe');
    expect(payload.iat).toBe(1516239022);
    expect(signature).toBe('SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c');
  });

  it('base64url decode handles UTF-8 and missing padding', () => {
    // base64url for {"name":"héllo"} has no padding chars
    const seg = 'eyJuYW1lIjoiaMOpbGxvIn0';
    expect(JSON.parse(base64UrlDecode(seg)).name).toBe('héllo');
  });

  it('reports no expiry when exp is absent', () => {
    expect(isExpired(decodeJwt(SAMPLE).payload)).toBeNull();
  });

  it('detects expired and valid windows against a fixed clock', () => {
    const now = 1_600_000_000_000;
    expect(isExpired({ exp: 1_500_000_000 }, now)).toBe(true);
    expect(isExpired({ exp: 1_700_000_000 }, now)).toBe(false);
  });

  it('surfaces standard time claims as ISO + relative', () => {
    const rows = timeClaims({ iat: 1516239022, exp: 1516242622 }, 1516239022000);
    const keys = rows.map((r) => r.key);
    expect(keys).toContain('iat');
    expect(keys).toContain('exp');
    expect(rows.find((r) => r.key === 'iat')?.iso).toBe('2018-01-18T01:30:22.000Z');
  });

  it('accepts an unsecured two-segment token', () => {
    // header {"alg":"none"} . payload {"a":1}
    const { header, payload, signature } = decodeJwt('eyJhbGciOiJub25lIn0.eyJhIjoxfQ');
    expect(header.alg).toBe('none');
    expect(payload.a).toBe(1);
    expect(signature).toBe('');
  });

  it('throws on the wrong number of segments', () => {
    expect(() => decodeJwt('a.b.c.d')).toThrow();
    expect(() => decodeJwt('nodots')).toThrow();
  });

  it('throws when a segment is not JSON', () => {
    expect(() => decodeJwt('@@@.@@@')).toThrow();
  });
});
