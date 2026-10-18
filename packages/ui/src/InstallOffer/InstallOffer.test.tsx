import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { axeViolations, renderIn } from '../test/render.tsx';
import { InstallOffer } from './InstallOffer.tsx';

describe('InstallOffer', () => {
  it('asks the browser to install the app, or puts the offer away', async () => {
    const onInstall = vi.fn();
    const onDismiss = vi.fn();
    renderIn(<InstallOffer kind="prompt" onInstall={onInstall} onDismiss={onDismiss} />);
    expect(screen.getByRole('region', { name: 'RIVR on your home screen' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Install' }));
    await userEvent.click(screen.getByRole('button', { name: 'Not now' }));
    expect(onInstall).toHaveBeenCalledTimes(1);
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('tells an iPhone how, since only Safari can add it', () => {
    renderIn(<InstallOffer kind="ios" onDismiss={() => undefined} />);
    expect(screen.getByText('In Safari, tap Share, then Add to Home Screen.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Install' })).toBeNull();
  });

  it('has no accessibility violations', async () => {
    const { container } = renderIn(<InstallOffer kind="prompt" onInstall={() => undefined} onDismiss={() => undefined} />);
    expect(await axeViolations(container)).toEqual([]);
  });
});
