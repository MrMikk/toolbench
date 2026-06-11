// Side-effectful authentication: lazily loads Google Identity Services and uses
// its browser token model (no client secret, no backend) to obtain a short-lived
// access token. The token lives only in sessionStorage — never in the app's
// IndexedDB store. Pure predicates (isExpired) live in logic.ts.
import { isExpired, type TokenState } from './logic';

interface TokenResponse {
  access_token: string;
  expires_in: number;
  scope?: string;
  error?: string;
  error_description?: string;
}

interface TokenClient {
  requestAccessToken: (overrides?: { prompt?: string }) => void;
}

interface GoogleOAuth2 {
  initTokenClient(config: {
    client_id: string;
    scope: string;
    callback: (resp: TokenResponse) => void;
    error_callback?: (err: { type?: string; message?: string }) => void;
  }): TokenClient;
  revoke(accessToken: string, done?: () => void): void;
}

declare global {
  interface Window {
    google?: { accounts: { oauth2: GoogleOAuth2 } };
  }
}

const GSI_SRC = 'https://accounts.google.com/gsi/client';
const TOKEN_KEY = 'gcloud:token';

let gsiPromise: Promise<void> | null = null;

/** Inject the GSI client script once; resolves when it is ready to use. */
export function loadGsi(): Promise<void> {
  if (window.google?.accounts?.oauth2) return Promise.resolve();
  if (gsiPromise) return gsiPromise;
  gsiPromise = new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = GSI_SRC;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      gsiPromise = null;
      reject(new Error('Could not load Google Identity Services (check your connection).'));
    };
    document.head.appendChild(script);
  });
  return gsiPromise;
}

function saveToken(state: TokenState): void {
  try {
    sessionStorage.setItem(TOKEN_KEY, JSON.stringify(state));
  } catch {
    /* sessionStorage unavailable — keep the in-memory token only */
  }
}

/** The current non-expired token from sessionStorage, or null. */
export function getToken(): TokenState | null {
  try {
    const raw = sessionStorage.getItem(TOKEN_KEY);
    if (!raw) return null;
    const state = JSON.parse(raw) as TokenState;
    if (!state.accessToken || isExpired(state)) return null;
    return state;
  } catch {
    return null;
  }
}

/**
 * Acquire an access token via the GSI token model. Must be invoked from a user
 * gesture (e.g. a button click) so the consent popup is not blocked.
 */
export async function acquireToken(clientId: string, scopes: string[]): Promise<TokenState> {
  await loadGsi();
  const oauth2 = window.google?.accounts?.oauth2;
  if (!oauth2) throw new Error('Google Identity Services failed to initialise.');

  return new Promise<TokenState>((resolve, reject) => {
    const client = oauth2.initTokenClient({
      client_id: clientId,
      scope: scopes.join(' '),
      callback: (resp) => {
        if (resp.error) {
          reject(new Error(resp.error_description || resp.error));
          return;
        }
        const state: TokenState = {
          accessToken: resp.access_token,
          expiresAt: Date.now() + (resp.expires_in || 3600) * 1000,
        };
        saveToken(state);
        resolve(state);
      },
      error_callback: (err) => reject(new Error(err.message || err.type || 'Authorization was cancelled.')),
    });
    client.requestAccessToken({ prompt: '' });
  });
}

/** Revoke the token (best effort) and clear it from sessionStorage. */
export function signOut(token?: string): void {
  try {
    if (token) window.google?.accounts?.oauth2?.revoke(token);
  } catch {
    /* revoke is best-effort */
  }
  try {
    sessionStorage.removeItem(TOKEN_KEY);
  } catch {
    /* ignore */
  }
}
