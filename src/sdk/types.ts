import type { ComponentType } from 'preact';

/**
 * Async key/value storage handed to a mini app, namespaced to that app's slug so
 * apps cannot collide. Backed by IndexedDB today; a sync adapter can later wrap
 * this same interface without changing app code.
 */
export interface AppStorage {
  get<T>(key: string): Promise<T | undefined>;
  set<T>(key: string, value: T): Promise<void>;
  delete(key: string): Promise<void>;
  keys(): Promise<string[]>;
}

/** An action contributed to the spotlight command palette. */
export interface Command {
  /** Stable, unique id (prefix with the app slug to avoid collisions). */
  id: string;
  title: string;
  subtitle?: string;
  /** Extra text matched by the fuzzy filter but not displayed. */
  keywords?: string;
  run: () => void;
}

/** The minimal host API passed to every mini app. Grow only when an app needs it. */
export interface AppContext {
  /** The app's own slug. */
  slug: string;
  storage: AppStorage;
  /** Navigate to another app by slug, or '' / '/' for the launcher. */
  navigate: (slug: string) => void;
  /** Contribute commands to the spotlight while this app is mounted. */
  registerCommands: (commands: Command[]) => void;
}

export interface AppProps {
  ctx: AppContext;
}

/** A registered mini app. Adding one = create a folder + add an entry to the registry. */
export interface MiniApp {
  /** URL segment (/a/:slug) and spotlight id. Must be unique. */
  slug: string;
  title: string;
  description?: string;
  icon?: ComponentType<{ class?: string }>;
  /** Lazy entry point, enabling per-app code-splitting. */
  load: () => Promise<{ default: ComponentType<AppProps> }>;
  /** Static commands surfaced in spotlight even before the app is opened. */
  commands?: (ctx: AppContext) => Command[];
}
