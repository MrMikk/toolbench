import { render } from 'preact';
import { App } from './shell/App';
import { RouterProvider } from './shell/router';
import { applyTheme, getInitialTheme } from './shell/theme';
import './styles.css';

// Apply the theme before first paint to avoid a flash.
applyTheme(getInitialTheme());

render(
  <RouterProvider>
    <App />
  </RouterProvider>,
  document.getElementById('app')!,
);
