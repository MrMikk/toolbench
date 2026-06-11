import { useEffect, useMemo, useState } from 'preact/hooks';
import type { ComponentType } from 'preact';
import { useRouter } from './router';
import { clearDynamicCommands, setDynamicCommands } from './commands';
import { setLastApp } from './lastApp';
import { createAppContext } from '../sdk';
import type { AppProps, MiniApp } from '../sdk';

/** Lazy-loads a mini app, builds its AppContext, and renders it. */
export function AppHost({ app }: { app: MiniApp }) {
  const { navigate } = useRouter();
  const [Comp, setComp] = useState<ComponentType<AppProps> | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setLastApp(app.slug);
    let cancelled = false;
    setComp(null);
    setFailed(false);
    app
      .load()
      .then((m) => {
        if (!cancelled) setComp(() => m.default);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
      clearDynamicCommands(app.slug);
    };
  }, [app]);

  const ctx = useMemo(
    () =>
      createAppContext({
        slug: app.slug,
        navigate: (slug) => navigate(slug ? `/a/${slug}` : '/'),
        registerCommands: (cmds) => setDynamicCommands(app.slug, cmds),
      }),
    [app, navigate],
  );

  return (
    <div class="app-view">
      <header class="app-view-header">
        <h1>{app.title}</h1>
        {app.description && <p>{app.description}</p>}
      </header>
      {failed ? (
        <div class="empty">
          <p>Couldn’t load “{app.title}”. Check your connection and try again.</p>
        </div>
      ) : Comp ? (
        <Comp ctx={ctx} />
      ) : (
        <div class="empty">Loading…</div>
      )}
    </div>
  );
}
