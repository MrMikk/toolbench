import { DEFAULT_TIMEOUT_MS, evaluateHttp, type CheckResult, type HttpCheck } from './logic';

const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

function errMessage(e: unknown, url: string): string {
  const base = e instanceof Error ? e.message : String(e);
  if (/^http:\/\//i.test(url) && typeof location !== 'undefined' && location.protocol === 'https:') {
    return `${base} (mixed content: an https page cannot call http://)`;
  }
  return base;
}

async function safeText(res: Response): Promise<string> {
  try {
    return await res.text();
  } catch {
    return '';
  }
}

/**
 * Run an HTTP check. In 'auto' mode a normal (cors) fetch is tried first; if it
 * fails with a network/CORS error we retry with no-cors to distinguish "blocked
 * but reachable" (opaque) from "truly unreachable" (error).
 */
export async function runHttpCheck(
  check: HttpCheck,
  fetchImpl: typeof fetch = fetch,
): Promise<CheckResult> {
  const timeout = check.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const mode = check.mode ?? 'auto';
  const start = now();
  const elapsed = () => Math.round(now() - start);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  const init: RequestInit = {
    method: check.method,
    headers: check.headers,
    signal: controller.signal,
  };
  if (check.body && check.method !== 'GET' && check.method !== 'HEAD') init.body = check.body;

  const timedOut = (): CheckResult => ({
    outcome: 'timeout',
    latencyMs: elapsed(),
    at: Date.now(),
    message: `Timed out after ${timeout} ms`,
  });

  try {
    if (mode === 'no-cors') {
      await fetchImpl(check.url, { ...init, mode: 'no-cors' });
      return { outcome: 'opaque', latencyMs: elapsed(), at: Date.now(), message: 'Reachable (opaque — status unverified)' };
    }

    const res = await fetchImpl(check.url, { ...init, mode: 'cors' });
    const latencyMs = elapsed();
    const body = await safeText(res);
    return evaluateHttp(check, res.status, body, latencyMs);
  } catch (e) {
    if (controller.signal.aborted) return timedOut();
    if (mode === 'cors') {
      return { outcome: 'error', latencyMs: elapsed(), at: Date.now(), message: errMessage(e, check.url) };
    }
    // auto: fall back to a reachability probe.
    try {
      await fetchImpl(check.url, { ...init, mode: 'no-cors' });
      return {
        outcome: 'opaque',
        latencyMs: elapsed(),
        at: Date.now(),
        message: 'Reachable but CORS-blocked (status unverified)',
      };
    } catch (e2) {
      if (controller.signal.aborted) return timedOut();
      return { outcome: 'error', latencyMs: elapsed(), at: Date.now(), message: errMessage(e2, check.url) };
    }
  } finally {
    clearTimeout(timer);
  }
}
