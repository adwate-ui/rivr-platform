import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { axeViolations, renderIn } from '../test/render.tsx';
import { Banner } from './Banner.tsx';

describe('Banner', () => {
  it('reads its line out politely', () => {
    renderIn(<Banner>RIVR opens on Sunday 15 November.</Banner>);
    expect(screen.getByRole('status')).toHaveTextContent('RIVR opens on Sunday 15 November.');
  });

  it('runs its action and its dismiss', async () => {
    const onPress = vi.fn();
    const onDismiss = vi.fn();
    renderIn(<Banner action={{ label: 'Retry', onPress }} onDismiss={onDismiss}>Couldn't refresh.</Banner>);
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }));
    await userEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(onPress).toHaveBeenCalledOnce();
    expect(onDismiss).toHaveBeenCalledOnce();
  });

  it('names its action more fully for a screen reader where banners repeat it', async () => {
    const onPress = vi.fn();
    renderIn(<Banner tone="alert" action={{ label: 'Release', name: 'Release Venue freeze', onPress }}>Venue freeze is engaged.</Banner>);
    await userEvent.click(screen.getByRole('button', { name: 'Release Venue freeze' }));
    expect(onPress).toHaveBeenCalledOnce();
  });

  it('never offers to dismiss an alert', () => {
    renderIn(<Banner tone="alert" onDismiss={() => undefined}>The club is paused.</Banner>);
    expect(screen.queryByRole('button', { name: 'Dismiss' })).not.toBeInTheDocument();
  });

  it('has no accessibility violations', async () => {
    const { container } = renderIn(<Banner action={{ label: 'Add time', onPress: () => undefined }}>Call time ends in 14 min</Banner>);
    expect(await axeViolations(container)).toEqual([]);
  });
});
