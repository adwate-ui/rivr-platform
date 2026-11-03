import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { PlayerShell } from '../PlayerShell/PlayerShell.tsx';
import { PLAYER_TABS } from '../storybook/fixtures.ts';
import { axeViolations, renderIn } from '../test/render.tsx';
import { PlayerAvatar } from './PlayerAvatar.tsx';

describe('PlayerAvatar', () => {
  it('is the shell’s initial where the screen puts it, and opens Profile', async () => {
    const onNavigate = vi.fn();
    const { container } = renderIn(
      <PlayerShell tabs={PLAYER_TABS} currentTab="home" avatar={{ initial: 'I', href: '/profile' }} onNavigate={onNavigate}>
        <p><span>RIVR</span><PlayerAvatar /></p>
      </PlayerShell>,
    );
    const link = screen.getByRole('link', { name: 'Profile' });
    expect(screen.getByText('RIVR').parentElement).toContainElement(link);
    await userEvent.click(link);
    expect(onNavigate).toHaveBeenCalledWith('/profile');
    expect(await axeViolations(container)).toEqual([]);
  });

  it('draws nothing outside a shell, or in one without an initial, as on a pushed screen', () => {
    renderIn(<PlayerAvatar />);
    expect(screen.queryByRole('link', { name: 'Profile' })).toBeNull();
    renderIn(<PlayerShell tabs={PLAYER_TABS} isTabBarHidden><PlayerAvatar /></PlayerShell>);
    expect(screen.queryByRole('link', { name: 'Profile' })).toBeNull();
  });
});
