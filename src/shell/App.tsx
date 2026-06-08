import { useEffect, useState } from 'preact/hooks';
import { useRouter } from './router';
import { useTheme } from './theme';
import { Nav } from './Nav';
import { Home } from './Home';
import { Spotlight } from './Spotlight';
import { AppHost } from './AppHost';
import { findApp } from '../apps/registry';

export function App() {
  const { path } = useRouter();
  const { theme, toggle } = useTheme();
  const [spotlightOpen, setSpotlightOpen] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSpotlightOpen((o) => !o);
      } else if (e.key === 'Escape') {
        setSpotlightOpen(false);
      }
    };
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  }, []);

  return (
    <div class="layout">
      <Nav
        path={path}
        theme={theme}
        onToggleTheme={toggle}
        onOpenSpotlight={() => setSpotlightOpen(true)}
      />
      <main class="content">
        <Route path={path} />
      </main>
      {spotlightOpen && (
        <Spotlight onToggleTheme={toggle} onClose={() => setSpotlightOpen(false)} />
      )}
    </div>
  );
}

function Route({ path }: { path: string }) {
  if (path === '/') return <Home />;
  const match = path.match(/^\/a\/([^/]+)/);
  if (match) {
    const app = findApp(match[1]);
    if (app) return <AppHost key={app.slug} app={app} />;
  }
  return (
    <div class="empty">
      <h1>Not found</h1>
      <p>
        That page doesn’t exist. Press <kbd>⌘K</kbd> to find a tool.
      </p>
    </div>
  );
}
