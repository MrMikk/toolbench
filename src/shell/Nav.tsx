import { Link } from './router';
import type { Theme } from './theme';
import { apps } from '../apps/registry';

interface NavProps {
  path: string;
  theme: Theme;
  onToggleTheme: () => void;
  onOpenSpotlight: () => void;
}

export function Nav({ path, theme, onToggleTheme, onOpenSpotlight }: NavProps) {
  return (
    <nav class="nav">
      <div class="nav-top">
        <Link to="/" class="brand" aria-label="Toolbench home">
          <img src={`${import.meta.env.BASE_URL}favicon.svg`} alt="" width={24} height={24} />
          <span>Toolbench</span>
        </Link>
        <button class="nav-search" onClick={onOpenSpotlight}>
          <span>Search…</span>
          <kbd>⌘K</kbd>
        </button>
      </div>

      <ul class="nav-apps">
        {apps.map((app) => {
          const active = path === `/a/${app.slug}` || path.startsWith(`/a/${app.slug}/`);
          return (
            <li key={app.slug}>
              <Link to={`/a/${app.slug}`} class={`nav-link ${active ? 'active' : ''}`}>
                {app.icon && <app.icon class="nav-icon" />}
                <span>{app.title}</span>
              </Link>
            </li>
          );
        })}
      </ul>

      <div class="nav-bottom">
        <button class="icon-btn" onClick={onToggleTheme} aria-label="Toggle colour theme">
          {theme === 'dark' ? '☀' : '☾'}
        </button>
      </div>
    </nav>
  );
}
