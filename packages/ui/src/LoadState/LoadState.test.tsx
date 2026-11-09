import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { axeViolations, renderIn } from '../test/render.tsx';
import { LoadState } from './LoadState.tsx';

describe('LoadState', () => {
  it('says it is loading, politely', async () => {
    const { container } = renderIn(<LoadState />);
    expect(screen.getByRole('status')).toHaveTextContent('Loading');
    expect(await axeViolations(container)).toEqual([]);
  });

  it('says it failed at once, and retries from the keyboard', async () => {
    const onRetry = vi.fn();
    renderIn(<LoadState isError onRetry={onRetry} />);
    expect(screen.getByRole('alert')).toBeInTheDocument();
    screen.getByRole('button').focus();
    await userEvent.keyboard('{Enter}');
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it('draws a whole player screen that failed as a serif line over what to do, and offers Try again (F-176)', async () => {
    const onRetry = vi.fn();
    renderIn(<LoadState isError look="serif" onRetry={onRetry} />);
    const alert = screen.getByRole('alert');
    expect(within(alert).getByRole('heading', { name: 'Could not load' })).toHaveClass('font-display', 'text-28');
    expect(alert).toHaveTextContent('Check your connection and try again.');
    await userEvent.click(within(alert).getByRole('button', { name: 'Try again' }));
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it('keeps the screen\u2019s own words under the serif line', () => {
    renderIn(<LoadState isError look="serif" errorText="No connection. Give your number at the door." />);
    expect(screen.getByRole('alert')).toHaveTextContent('No connection. Give your number at the door.');
    expect(screen.getByRole('alert')).not.toHaveTextContent('Check your connection');
  });

  it('takes the serif line and what the member still needs under it, in the failure\u2019s own alert', () => {
    renderIn(<LoadState isError look="serif" title="No connection" errorText="Give your number at the door."><span>1024</span></LoadState>);
    const alert = screen.getByRole('alert');
    expect(within(alert).getByRole('heading', { name: 'No connection' })).toBeInTheDocument();
    expect(within(alert).getByText('1024')).toBeInTheDocument();
    expect(alert).toHaveTextContent('Give your number at the door.');
  });

  it('says why when told, and offers no Retry without one', () => {
    renderIn(<LoadState isError errorText="The archive could not be read." />);
    expect(screen.getByRole('alert')).toHaveTextContent('The archive could not be read.');
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('says it is loading in TV type, politely (F-141)', () => {
    renderIn(<LoadState size="tv" />);
    const status = screen.getByRole('status');
    expect(status).toHaveTextContent('Loading');
    expect(within(status).getByText('Loading').className).toContain('text-36');
  });

  it('says a TV board failed in its own words, and offers no Retry, as nobody can press one', () => {
    renderIn(<LoadState size="tv" isError errorText="This board is not available." onRetry={() => undefined} />);
    const alert = screen.getByRole('alert');
    expect(within(alert).getByText('This board is not available.').className).toContain('text-36');
    expect(within(alert).queryByRole('button')).toBeNull();
  });
});
