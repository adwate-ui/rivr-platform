import { screen } from '@testing-library/react';
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

  it('says why when told, and offers no Retry without one', () => {
    renderIn(<LoadState isError errorText="The archive could not be read." />);
    expect(screen.getByRole('alert')).toHaveTextContent('The archive could not be read.');
    expect(screen.queryByRole('button')).toBeNull();
  });
});
