import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { useRouter } from './router';
import { apps } from '../apps/registry';
import { getDynamicCommands, subscribeCommands } from './commands';
import { fuzzyFilter } from './fuzzy';
import type { Command } from '../sdk/types';

interface SpotlightProps {
  onClose: () => void;
  onToggleTheme: () => void;
}

export function Spotlight({ onClose, onToggleTheme }: SpotlightProps) {
  const { navigate } = useRouter();
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const [tick, setTick] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    return subscribeCommands(() => setTick((n) => n + 1));
  }, []);

  const commands = useMemo<Command[]>(() => {
    const nav: Command[] = apps.map((app) => ({
      id: `goto:${app.slug}`,
      title: app.title,
      subtitle: app.description,
      keywords: 'open app tool',
      run: () => navigate(`/a/${app.slug}`),
    }));
    const builtins: Command[] = [
      { id: 'app:home', title: 'Home', keywords: 'launcher start', run: () => navigate('/') },
      { id: 'app:theme', title: 'Toggle theme', keywords: 'dark light mode appearance', run: onToggleTheme },
    ];
    return [...nav, ...getDynamicCommands(), ...builtins];
    // `tick` forces recompute when an app registers/clears dynamic commands.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigate, onToggleTheme, tick]);

  const results = useMemo(
    () => fuzzyFilter(query, commands, (c) => `${c.title} ${c.subtitle ?? ''} ${c.keywords ?? ''}`),
    [query, commands],
  );

  useEffect(() => setActive(0), [query]);

  const choose = (cmd: Command | undefined) => {
    if (!cmd) return;
    cmd.run();
    onClose();
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      choose(results[active]);
    }
  };

  return (
    <div class="spotlight-overlay" onClick={onClose}>
      <div class="spotlight" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <input
          ref={inputRef}
          class="spotlight-input"
          placeholder="Search tools and commands…"
          value={query}
          onInput={(e) => setQuery((e.target as HTMLInputElement).value)}
          onKeyDown={onKeyDown}
        />
        <ul class="spotlight-results">
          {results.length === 0 && <li class="spotlight-empty">No matches</li>}
          {results.map((cmd, i) => (
            <li key={cmd.id}>
              <button
                class={`spotlight-item ${i === active ? 'active' : ''}`}
                onMouseEnter={() => setActive(i)}
                onClick={() => choose(cmd)}
              >
                <span class="spotlight-title">{cmd.title}</span>
                {cmd.subtitle && <span class="spotlight-subtitle">{cmd.subtitle}</span>}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
