import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { reportError } from './features/error-reporting/index.ts';
import { createAppRouter, ScreenFailed } from './router.tsx';

afterEach(cleanup);

describe('the router', () => {
  it('shows a screen that fails to draw as an error with Try again, which draws it again', () => {
    const reset = vi.fn();
    render(<ScreenFailed error={new Error('A bad timestamp')} reset={reset} />);
    expect(screen.getByRole('heading', { name: 'Screen unavailable' })).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(reset).toHaveBeenCalledOnce();
  });

  it('reports a screen that failed to draw, as well as showing it', () => {
    expect(createAppRouter().options.defaultOnCatch).toBe(reportError);
  });
});
