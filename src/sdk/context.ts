import { createAppStorage } from './storage';
import type { AppContext, Command } from './types';

/** Builds the AppContext handed to a mini app when it mounts. */
export function createAppContext(opts: {
  slug: string;
  navigate: (slug: string) => void;
  registerCommands: (commands: Command[]) => void;
}): AppContext {
  return {
    slug: opts.slug,
    storage: createAppStorage(opts.slug),
    navigate: opts.navigate,
    registerCommands: opts.registerCommands,
  };
}
