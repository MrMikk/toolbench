import type { Command } from '../sdk/types';

/**
 * A tiny pub/sub store for commands the currently-mounted app contributes to the
 * spotlight at runtime (via ctx.registerCommands). Keyed by app slug so unmounting
 * an app cleanly removes its commands.
 */
type Listener = () => void;

const dynamic = new Map<string, Command[]>();
const listeners = new Set<Listener>();

function emit() {
  listeners.forEach((l) => l());
}

export function setDynamicCommands(slug: string, commands: Command[]): void {
  if (commands.length) dynamic.set(slug, commands);
  else dynamic.delete(slug);
  emit();
}

export function clearDynamicCommands(slug: string): void {
  if (dynamic.delete(slug)) emit();
}

export function getDynamicCommands(): Command[] {
  return [...dynamic.values()].flat();
}

export function subscribeCommands(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
