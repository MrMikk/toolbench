export interface Jwt {
  header: Record<string, unknown>;
  payload: Record<string, unknown>;
  signature: string;
}

/** Decode a base64url segment to a UTF-8 string. Throws on malformed input. */
export function base64UrlDecode(seg: string): string {
  const b64 = seg.replace(/-/g, '+').replace(/_/g, '/');
  const padded = b64.padEnd(Math.ceil(b64.length / 4) * 4, '=');
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function parseSegment(seg: string, which: string): Record<string, unknown> {
  let json: unknown;
  try {
    json = JSON.parse(base64UrlDecode(seg));
  } catch {
    throw new Error(`The ${which} is not valid base64url-encoded JSON.`);
  }
  if (typeof json !== 'object' || json === null || Array.isArray(json)) {
    throw new Error(`The ${which} must be a JSON object.`);
  }
  return json as Record<string, unknown>;
}

/** Decode (not verify) a JWT into its header, payload and raw signature. */
export function decodeJwt(token: string): Jwt {
  const parts = token.trim().split('.');
  if (parts.length < 2 || parts.length > 3) {
    throw new Error('A JWT has two or three dot-separated segments.');
  }
  return {
    header: parseSegment(parts[0], 'header'),
    payload: parseSegment(parts[1], 'payload'),
    signature: parts[2] ?? '',
  };
}

export interface ClaimTime {
  key: string;
  label: string;
  iso: string;
  relative: string;
}

const TIME_CLAIMS: Record<string, string> = {
  iat: 'Issued at',
  nbf: 'Not before',
  exp: 'Expires',
};

function relative(targetMs: number, nowMs: number): string {
  const diff = targetMs - nowMs;
  const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ['year', 31536e6],
    ['day', 864e5],
    ['hour', 36e5],
    ['minute', 6e4],
    ['second', 1e3],
  ];
  for (const [unit, ms] of units) {
    if (Math.abs(diff) >= ms || unit === 'second') return rtf.format(Math.round(diff / ms), unit);
  }
  return 'now';
}

/** Human-readable rows for the standard time claims present in a payload. */
export function timeClaims(payload: Record<string, unknown>, now = Date.now()): ClaimTime[] {
  const rows: ClaimTime[] = [];
  for (const [key, label] of Object.entries(TIME_CLAIMS)) {
    const v = payload[key];
    if (typeof v !== 'number') continue;
    const ms = v * 1000;
    rows.push({ key, label, iso: new Date(ms).toISOString(), relative: relative(ms, now) });
  }
  return rows;
}

/** True if expired, false if still valid, null if the token carries no `exp`. */
export function isExpired(payload: Record<string, unknown>, now = Date.now()): boolean | null {
  const exp = payload.exp;
  if (typeof exp !== 'number') return null;
  return exp * 1000 <= now;
}
