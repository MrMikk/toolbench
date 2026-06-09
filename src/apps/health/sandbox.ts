import { DEFAULT_TIMEOUT_MS, normalizeJsResult, type CheckResult, type JsCheck } from './logic';

const errMsg = (e: unknown) => (e instanceof Error ? e.message : String(e));

/**
 * Run a user-authored JS check inside a Web Worker, raced against a timeout.
 * On timeout the worker is terminated, so an infinite loop cannot wedge the tab.
 */
export async function runJsCheck(check: JsCheck): Promise<CheckResult> {
  const timeout = check.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const start = Date.now();

  let worker: Worker;
  try {
    const Ctor = (await import('./worker?worker')).default;
    worker = new Ctor();
  } catch (e) {
    return { outcome: 'error', at: Date.now(), message: 'Could not start worker: ' + errMsg(e) };
  }

  return new Promise<CheckResult>((resolve) => {
    const finish = (r: CheckResult) => {
      clearTimeout(timer);
      worker.terminate();
      resolve(r);
    };
    const timer = setTimeout(
      () =>
        finish({
          outcome: 'timeout',
          latencyMs: Date.now() - start,
          at: Date.now(),
          message: `Timed out after ${timeout} ms (worker terminated)`,
        }),
      timeout,
    );
    worker.onmessage = (e: MessageEvent) => {
      const d = e.data as { ok: boolean; result?: unknown; error?: string };
      const latencyMs = Date.now() - start;
      if (d?.ok) finish(normalizeJsResult(d.result, latencyMs));
      else finish({ outcome: 'error', latencyMs, at: Date.now(), message: d?.error ?? 'Unknown error' });
    };
    worker.onerror = (e: ErrorEvent) => {
      finish({ outcome: 'error', latencyMs: Date.now() - start, at: Date.now(), message: e.message || 'Worker error' });
    };
    worker.postMessage({ source: check.source });
  });
}
