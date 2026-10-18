import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { PLAYER_TABS } from '../storybook/fixtures.ts';
import { axeViolations, renderIn } from '../test/render.tsx';
import { PlayerShell } from './PlayerShell.tsx';

function renderShell(onNavigate = vi.fn()) {
  return renderIn(
    <PlayerShell tabs={PLAYER_TABS} currentTab="home" memberInitial="A" profileHref="/profile" onNavigate={onNavigate} banner={<p>Venue frozen.</p>}>
      <h1>Tonight</h1>
    </PlayerShell>,
  );
}

describe('PlayerShell', () => {
  it('puts the screen in the main landmark and the tabs in navigation', () => {
    renderShell();
    expect(screen.getByRole('main')).toHaveTextContent('Tonight');
    expect(screen.getByRole('navigation', { name: 'Main' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Home' })).toHaveAttribute('aria-current', 'page');
  });

  it('opens Profile from the member initial, top right', async () => {
    const onNavigate = vi.fn();
    renderShell(onNavigate);
    const profile = screen.getByRole('link', { name: 'Profile' });
    expect(profile).toHaveTextContent('A');
    await userEvent.click(profile);
    expect(onNavigate).toHaveBeenCalledWith('/profile');
  });

  it('shows the banner first, before the profile link in focus order', async () => {
    renderShell();
    expect(screen.getByText('Venue frozen.')).toBeInTheDocument();
    await userEvent.tab();
    expect(screen.getByRole('link', { name: 'Profile' })).toHaveFocus();
  });

  it('has no accessibility violations', async () => {
    const { container } = renderShell();
    expect(await axeViolations(container)).toEqual([]);
  });
});
