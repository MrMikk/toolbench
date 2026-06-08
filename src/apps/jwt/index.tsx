import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import type { AppProps } from '../../sdk';
import { Button, CopyButton, Field, TextArea, Toolbar } from '../../ui';
import { decodeJwt, isExpired, timeClaims } from './logic';

const STORAGE_KEY = 'state';

const SAMPLE =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6Ik' +
  'pvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';

export default function JwtApp({ ctx }: AppProps) {
  const [token, setToken] = useState('');
  const loaded = useRef(false);

  useEffect(() => {
    ctx.storage.get<string>(STORAGE_KEY).then((saved) => {
      if (typeof saved === 'string') setToken(saved);
      loaded.current = true;
    });
  }, [ctx]);

  useEffect(() => {
    if (!loaded.current) return;
    void ctx.storage.set<string>(STORAGE_KEY, token);
  }, [ctx, token]);

  useEffect(() => {
    ctx.registerCommands([
      { id: 'jwt:sample', title: 'JWT: Load sample token', run: () => setToken(SAMPLE) },
      { id: 'jwt:clear', title: 'JWT: Clear', run: () => setToken('') },
    ]);
  }, [ctx]);

  const decoded = useMemo(() => {
    if (!token.trim()) return null;
    try {
      const jwt = decodeJwt(token);
      return { ok: true as const, jwt };
    } catch (e) {
      return { ok: false as const, error: e instanceof Error ? e.message : 'Invalid token' };
    }
  }, [token]);

  const alg = decoded?.ok ? String(decoded.jwt.header.alg ?? '—') : '—';
  const expired = decoded?.ok ? isExpired(decoded.jwt.payload) : null;
  const claims = decoded?.ok ? timeClaims(decoded.jwt.payload) : [];

  return (
    <div class="stack">
      <Field label="Token">
        <TextArea
          value={token}
          class={decoded && !decoded.ok ? 'has-error' : ''}
          placeholder="Paste a JWT (header.payload.signature)…"
          onInput={(e) => setToken((e.target as HTMLTextAreaElement).value)}
        />
      </Field>

      {decoded && !decoded.ok && <p class="error-text">{decoded.error}</p>}

      {decoded?.ok && (
        <>
          <Toolbar>
            <span class="badge">alg · {alg}</span>
            {expired === true && <span class="badge badge-fail">Expired</span>}
            {expired === false && <span class="badge badge-pass">Valid window</span>}
          </Toolbar>

          {claims.length > 0 && (
            <div class="kv-table">
              {claims.map((c) => (
                <div class="kv-row" key={c.key}>
                  <span class="kv-label">
                    {c.label} ({c.key})
                  </span>
                  <span class="kv-value">
                    {c.iso} · {c.relative}
                  </span>
                  <span />
                </div>
              ))}
            </div>
          )}

          <div class="io-grid">
            <Field label="Header">
              <TextArea readOnly value={JSON.stringify(decoded.jwt.header, null, 2)} />
            </Field>
            <Field label="Payload">
              <TextArea readOnly value={JSON.stringify(decoded.jwt.payload, null, 2)} />
            </Field>
          </div>

          <Toolbar>
            <CopyButton
              variant="primary"
              label="Copy payload"
              value={JSON.stringify(decoded.jwt.payload, null, 2)}
            />
            <CopyButton label="Copy header" value={JSON.stringify(decoded.jwt.header, null, 2)} />
            <Button onClick={() => setToken('')} disabled={!token}>
              Clear
            </Button>
          </Toolbar>
        </>
      )}

      {!token.trim() && (
        <p class="note">
          Decodes the header and payload locally — nothing is sent anywhere. Signatures are shown but
          not verified.
        </p>
      )}
    </div>
  );
}
