// Remembers the most recently opened app so a fresh page load can jump straight
// back to it. Shell-level state (not per-app), so it lives in localStorage
// alongside the theme rather than in an app's namespaced IndexedDB store.
const KEY = 'toolbench:last-app';

export function getLastApp(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function setLastApp(slug: string): void {
  try {
    localStorage.setItem(KEY, slug);
  } catch {
    /* storage unavailable (private mode, quota) — remembering is best-effort */
  }
}
