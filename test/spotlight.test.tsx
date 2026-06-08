import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/preact';
import { RouterProvider } from '../src/shell/router';
import { Spotlight } from '../src/shell/Spotlight';

afterEach(cleanup);

function renderSpotlight() {
  const onClose = vi.fn();
  const onToggleTheme = vi.fn();
  render(
    <RouterProvider>
      <Spotlight onClose={onClose} onToggleTheme={onToggleTheme} />
    </RouterProvider>,
  );
  return { onClose, onToggleTheme };
}

describe('Spotlight', () => {
  it('lists registered apps and built-in commands initially', () => {
    renderSpotlight();
    expect(screen.getByText('Encoder / Decoder')).toBeInTheDocument();
    expect(screen.getByText('Formatter')).toBeInTheDocument();
    expect(screen.getByText('Toggle theme')).toBeInTheDocument();
  });

  it('filters results by fuzzy query', () => {
    renderSpotlight();
    fireEvent.input(screen.getByPlaceholderText(/search/i), { target: { value: 'form' } });
    expect(screen.getByText('Formatter')).toBeInTheDocument();
    expect(screen.queryByText('Encoder / Decoder')).not.toBeInTheDocument();
  });

  it('runs a command on click and then closes', () => {
    const { onClose, onToggleTheme } = renderSpotlight();
    fireEvent.click(screen.getByText('Toggle theme'));
    expect(onToggleTheme).toHaveBeenCalledOnce();
    expect(onClose).toHaveBeenCalledOnce();
  });
});
