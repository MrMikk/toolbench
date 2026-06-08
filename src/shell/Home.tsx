import { Link } from './router';
import { apps } from '../apps/registry';

export function Home() {
  return (
    <div class="home">
      <header class="home-header">
        <h1>Toolbench</h1>
        <p>
          Small, fast, browser-only tools. Press <kbd>⌘K</kbd> to jump anywhere.
        </p>
      </header>
      <div class="app-grid">
        {apps.map((app) => (
          <Link key={app.slug} to={`/a/${app.slug}`} class="app-card">
            {app.icon && <app.icon class="app-card-icon" />}
            <h2>{app.title}</h2>
            {app.description && <p>{app.description}</p>}
          </Link>
        ))}
      </div>
    </div>
  );
}
