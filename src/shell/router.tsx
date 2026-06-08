import { createContext } from 'preact';
import type { ComponentChildren, JSX } from 'preact';
import { useContext, useState, useEffect, useCallback } from 'preact/hooks';

// '' for root deploys, '/toolbench' for the GitHub Pages project subpath.
const BASE = import.meta.env.BASE_URL.replace(/\/+$/, '');

/** Strip the deploy base prefix to get an app-internal path that starts with '/'. */
export function toInternal(pathname: string): string {
  let p = pathname;
  if (BASE && (p === BASE || p.startsWith(BASE + '/'))) p = p.slice(BASE.length);
  if (!p.startsWith('/')) p = '/' + p;
  return p;
}

/** Prefix an internal path with the deploy base, for href / history.pushState. */
export function toHref(path: string): string {
  const p = path.startsWith('/') ? path : '/' + path;
  return BASE + p || '/';
}

interface RouterValue {
  path: string;
  navigate: (path: string) => void;
}

const RouterContext = createContext<RouterValue>({ path: '/', navigate: () => {} });

export function RouterProvider({ children }: { children: ComponentChildren }) {
  const [path, setPath] = useState(() => toInternal(location.pathname));

  useEffect(() => {
    const onPop = () => setPath(toInternal(location.pathname));
    addEventListener('popstate', onPop);
    return () => removeEventListener('popstate', onPop);
  }, []);

  const navigate = useCallback(
    (to: string) => {
      const internal = to.startsWith('/') ? to : '/' + to;
      if (internal === path) return;
      history.pushState(null, '', toHref(internal));
      setPath(internal);
      scrollTo(0, 0);
    },
    [path],
  );

  return <RouterContext.Provider value={{ path, navigate }}>{children}</RouterContext.Provider>;
}

export function useRouter(): RouterValue {
  return useContext(RouterContext);
}

/** An anchor that routes client-side but preserves modifier-click / middle-click. */
export function Link({
  to,
  onNavigate,
  children,
  ...rest
}: { to: string; onNavigate?: () => void; children: ComponentChildren } & Omit<
  JSX.IntrinsicElements['a'],
  'href'
>) {
  const { navigate } = useRouter();
  return (
    <a
      href={toHref(to)}
      onClick={(e) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
        e.preventDefault();
        navigate(to);
        onNavigate?.();
      }}
      {...rest}
    >
      {children}
    </a>
  );
}
