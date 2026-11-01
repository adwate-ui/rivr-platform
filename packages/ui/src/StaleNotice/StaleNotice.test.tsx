import { fireEvent, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { axeViolations, renderIn } from '../test/render.tsx';
import { StaleNotice } from './StaleNotice.tsx';

const SINCE = new Date('2026-11-15T20:42:00+05:30');

describe('StaleNotice', () => {
  it('says when what the screen shows last came, as an alert, and asks again on Try again', () => {
    const onRetry = vi.fn();
    renderIn(<StaleNotice since={SINCE} onRetry={onRetry} />);
    expect(screen.getByRole('alert')).toHaveTextContent('Not updated since 20:42. Check the connection.');
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it('works from the keyboard: Enter on Try again asks again', async () => {
    const onRetry = vi.fn();
    renderIn(<StaleNotice since={SINCE} onRetry={onRetry} />);
    screen.getByRole('button', { name: 'Try again' }).focus();
    await userEvent.keyboard('{Enter}');
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it('offers nothing to press without onRetry, as on a TV', () => {
    renderIn(<StaleNotice since={SINCE} />);
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('on a TV says it politely at the TV body size, with nothing to press, so each failed read is not announced again', () => {
    renderIn(<StaleNotice since={SINCE} variant="tv" />);
    expect(screen.getByRole('status')).toHaveTextContent('Not updated since 20:42. Check the connection.');
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('has no accessibility violations', async () => {
    const { container } = renderIn(<StaleNotice since={SINCE} onRetry={() => undefined} />);
    expect(await axeViolations(container)).toEqual([]);
  });
});
