// Web Worker: executes an untrusted async check function in isolation so the
// main thread stays responsive and a runaway function can be killed via
// worker.terminate(). The function receives { fetch } and returns a result.
const ctx = self as unknown as {
  onmessage: ((e: MessageEvent) => void) | null;
  postMessage: (msg: unknown) => void;
  fetch: typeof fetch;
};

ctx.onmessage = async (e: MessageEvent) => {
  const { source } = e.data as { source: string };
  try {
    // eslint-disable-next-line @typescript-eslint/no-implied-eval
    const factory = new Function('return (' + source + ')')() as (api: {
      fetch: typeof fetch;
    }) => unknown;
    if (typeof factory !== 'function') {
      throw new Error('Source must evaluate to an async function');
    }
    const result = await factory({ fetch: (input: RequestInfo | URL, init?: RequestInit) => ctx.fetch(input, init) });
    ctx.postMessage({ ok: true, result });
  } catch (err) {
    ctx.postMessage({ ok: false, error: err instanceof Error ? err.message : String(err) });
  }
};
