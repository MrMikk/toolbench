import { describe, it, expect } from 'vitest';
import {
  aggregateOutcome,
  assertBody,
  byteLength,
  evaluateHttp,
  formatBytes,
  groupChecks,
  matchStatus,
  moveCheckRelative,
  moveCheckToGroupEnd,
  moveGroupRelative,
  normalizeJsResult,
  parseCurl,
  pushHistory,
  successRatio,
  summarize,
  tokenizeCurl,
  type Check,
  type HttpCheck,
} from '../src/apps/health/logic';
import { runHttpCheck } from '../src/apps/health/runner';

const http = (over: Partial<HttpCheck> = {}): HttpCheck => ({
  id: 'c1',
  kind: 'http',
  name: 'c',
  enabled: true,
  method: 'GET',
  url: 'https://example.com',
  expect: '2xx',
  ...over,
});

describe('health: status & body matching', () => {
  it('matches status classes, ranges, exact and lists', () => {
    expect(matchStatus('2xx', 204)).toBe(true);
    expect(matchStatus('2xx', 404)).toBe(false);
    expect(matchStatus('200-204', 203)).toBe(true);
    expect(matchStatus('200,302', 302)).toBe(true);
    expect(matchStatus('200', 201)).toBe(false);
  });

  it('asserts body by contains and regex', () => {
    expect(assertBody('contains', 'up', 'status: up')).toBe(true);
    expect(assertBody('regex', '"db":\\s*"up"', '{"db": "up"}')).toBe(true);
    expect(assertBody('contains', 'down', 'status: up')).toBe(false);
  });

  it('evaluates pass and the failure reasons', () => {
    expect(evaluateHttp(http(), 200, 'ok', 12).outcome).toBe('pass');
    expect(evaluateHttp(http({ expect: '200' }), 500, '', 1).outcome).toBe('fail');
    expect(evaluateHttp(http({ bodyMatch: 'xyz', bodyMode: 'contains' }), 200, 'abc', 1).outcome).toBe('fail');
    expect(evaluateHttp(http({ bodyMatch: '(', bodyMode: 'regex' }), 200, 'abc', 1).message).toContain('invalid body regex');
  });

  it('reports the response size in bytes', () => {
    expect(evaluateHttp(http(), 200, 'abc', 1).sizeBytes).toBe(3);
    expect(byteLength('héllo')).toBe(6);
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(2048)).toBe('2.0 kB');
  });
});

describe('health: grouping & aggregation', () => {
  it('aggregates outcomes with failure dominating, then pending, then opaque', () => {
    expect(aggregateOutcome(['pass', 'pass'])).toBe('pass');
    expect(aggregateOutcome(['pass', 'fail'])).toBe('fail');
    expect(aggregateOutcome(['pass', 'pending'])).toBe('pending');
    expect(aggregateOutcome(['pass', 'opaque'])).toBe('opaque');
    expect(aggregateOutcome([])).toBe('pending');
  });

  it('partitions checks by group, preserving order', () => {
    const checks: Check[] = [
      http({ id: 'a', group: 'Prod' }),
      http({ id: 'b' }),
      http({ id: 'c', group: 'Prod' }),
    ];
    const groups = groupChecks(checks);
    expect(groups.map((g) => g.name)).toEqual(['Prod', '']);
    expect(groups[0].checks.map((c) => c.id)).toEqual(['a', 'c']);
    expect(groups[1].checks.map((c) => c.id)).toEqual(['b']);
  });
});

describe('health: drag reordering', () => {
  const cs = (): Check[] => [
    http({ id: 'a', group: 'G1' }),
    http({ id: 'b', group: 'G1' }),
    http({ id: 'c', group: 'G2' }),
    http({ id: 'd' }),
  ];

  it('moves a check after another, adopting the target group', () => {
    const r = moveCheckRelative(cs(), 'd', 'a', 'after');
    expect(r.map((c) => c.id)).toEqual(['a', 'd', 'b', 'c']);
    expect(r.find((c) => c.id === 'd')!.group).toBe('G1');
  });

  it('moves a check to the end of a group', () => {
    const r = moveCheckToGroupEnd(cs(), 'd', 'G2');
    const ids = r.map((c) => c.id);
    expect(r.find((c) => c.id === 'd')!.group).toBe('G2');
    expect(ids.indexOf('d')).toBe(ids.indexOf('c') + 1);
  });

  it('reorders a whole group, moving its checks as a block', () => {
    expect(moveGroupRelative(cs(), 'G2', 'G1', 'before').map((c) => c.id)).toEqual(['c', 'a', 'b', 'd']);
    expect(moveGroupRelative(cs(), 'G1', 'G2', 'after').map((c) => c.id)).toEqual(['c', 'a', 'b', 'd']);
  });
});

describe('health: curl parsing', () => {
  it('tokenizes quotes and line continuations', () => {
    expect(tokenizeCurl("curl -H 'A: b c' \\\n  https://x.test")).toEqual(['curl', '-H', 'A: b c', 'https://x.test']);
  });

  it('parses method, headers and body', () => {
    const { check } = parseCurl(`curl -X POST -H "Accept: application/json" -d '{"a":1}' https://api.test/h`);
    expect(check.method).toBe('POST');
    expect(check.url).toBe('https://api.test/h');
    expect(check.headers).toEqual({ Accept: 'application/json' });
    expect(check.body).toBe('{"a":1}');
  });

  it('upgrades to POST when data is present, and handles basic auth', () => {
    const { check } = parseCurl('curl -u user:pass -d x=1 https://api.test');
    expect(check.method).toBe('POST');
    expect(check.headers?.Authorization).toBe('Basic ' + btoa('user:pass'));
  });

  it('collects unsupported flags and flags a missing URL', () => {
    const { unsupported } = parseCurl('curl --cookie z=1 https://api.test');
    expect(unsupported).toContain('--cookie');
    expect(parseCurl('curl -X GET').error).toBeTruthy();
  });
});

describe('health: result + history helpers', () => {
  it('normalizes JS results', () => {
    expect(normalizeJsResult({ ok: true, status: 200 }).outcome).toBe('pass');
    expect(normalizeJsResult({ ok: false }).outcome).toBe('fail');
    expect(normalizeJsResult(42).outcome).toBe('error');
  });

  it('caps history and computes success ratio', () => {
    let h: ReturnType<typeof pushHistory> = [];
    for (let i = 0; i < 60; i++) h = pushHistory(h, { at: i, outcome: i % 2 ? 'pass' : 'fail' }, 50);
    expect(h).toHaveLength(50);
    expect(successRatio(h)).toBeCloseTo(0.5, 1);
  });

  it('summarizes enabled checks by outcome', () => {
    const checks: Check[] = [http({ id: 'a' }), http({ id: 'b' }), http({ id: 'c', enabled: false })];
    const s = summarize({ a: { outcome: 'pass', at: 0 }, b: { outcome: 'error', at: 0 } }, checks);
    expect(s).toEqual({ pass: 1, fail: 1, other: 0, total: 2 });
  });
});

describe('health: HTTP runner (mocked fetch)', () => {
  it('passes a 200 with a matching body', async () => {
    const fetchImpl = (async () => ({ status: 200, text: async () => 'current_user_url' })) as unknown as typeof fetch;
    const r = await runHttpCheck(http({ bodyMode: 'contains', bodyMatch: 'current_user_url' }), fetchImpl);
    expect(r.outcome).toBe('pass');
    expect(r.status).toBe(200);
  });

  it('falls back to an opaque result when CORS blocks the cors request', async () => {
    const fetchImpl = (async (_url: string, init: RequestInit) => {
      if (init.mode === 'no-cors') return {} as Response;
      throw new TypeError('Failed to fetch');
    }) as unknown as typeof fetch;
    expect((await runHttpCheck(http(), fetchImpl)).outcome).toBe('opaque');
  });

  it('reports error when even the no-cors probe fails', async () => {
    const fetchImpl = (async () => {
      throw new TypeError('Failed to fetch');
    }) as unknown as typeof fetch;
    expect((await runHttpCheck(http(), fetchImpl)).outcome).toBe('error');
  });

  it('times out and aborts a hanging request', async () => {
    const fetchImpl = ((_url: string, init: RequestInit) =>
      new Promise((_resolve, reject) => {
        init.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
      })) as unknown as typeof fetch;
    const r = await runHttpCheck(http({ timeoutMs: 20, mode: 'cors' }), fetchImpl);
    expect(r.outcome).toBe('timeout');
  });
});
