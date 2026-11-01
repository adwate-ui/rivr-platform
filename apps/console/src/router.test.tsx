import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ScreenFailed } from './router.tsx';

afterEach(cleanup);

describe('the router', () => {
  it('shows a screen that fails to draw as an error with Try again, which draws it again', () => {
    const reset = vi.fn();
    render(<ScreenFailed error={new Error('A bad timestamp')} reset={reset} />);
    expect(screen.getByRole('heading', { name: 'Screen unavailable. Reload the page.' })).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(reset).toHaveBeenCalledOnce();
  });
});
