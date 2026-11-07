import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Banner } from '../Banner/Banner.tsx';
import { PlayerAvatar } from '../PlayerAvatar/PlayerAvatar.tsx';
import { Screen } from '../Screen/Screen.tsx';
import { PLAYER_TABS } from '../storybook/fixtures.ts';
import { axeViolations, renderIn } from '../test/render.tsx';
import { PlayerDock, PlayerShell } from './PlayerShell.tsx';

function renderShell(props: { isTabBarHidden?: boolean; onNavigate?: () => void } = {}) {
  return renderIn(
    <PlayerShell tabs={PLAYER_TABS} currentTab="home" avatar={{ initial: 'I', href: '/profile' }} {...props}>
      <h1>Tonight</h1>
      <PlayerAvatar />
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
    renderShell({ onNavigate });
    await userEvent.click(screen.getByRole('link', { name: 'Profile' }));
    expect(onNavigate).toHaveBeenCalledWith('/profile');
  });

  it('sets the initial at the end of the screen’s heading row, a 44 px band, under any banner above it (owner, 3 Nov)', () => {
    renderIn(
      <PlayerShell tabs={PLAYER_TABS} currentTab="sessions" avatar={{ initial: 'I', href: '/profile' }}>
        <Banner>Offline. What you see may be out of date.</Banner>
        <Screen title="Sessions" titleLook="serif" />
      </PlayerShell>,
    );
    const row = screen.getByRole('heading', { name: 'Sessions' }).parentElement;
    if (row === null) throw new Error('The heading has no row');
    expect(row).toHaveClass('min-h-touch', 'items-center');
    expect(row).toContainElement(screen.getByRole('link', { name: 'Profile' }));
    expect(screen.getByRole('status').compareDocumentPosition(row)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  });

  it('gives a screen that heads itself the initial for its own header, once', () => {
    renderIn(
      <PlayerShell tabs={PLAYER_TABS} currentTab="home" avatar={{ initial: 'I', href: '/profile' }} isFullBleed>
        <Screen title="Tonight" isTitleHidden><p><span>RIVR</span><PlayerAvatar /></p></Screen>
      </PlayerShell>,
    );
    expect(screen.getAllByRole('link', { name: 'Profile' })).toHaveLength(1);
    expect(screen.getByText('RIVR').parentElement).toContainElement(screen.getByRole('link', { name: 'Profile' }));
  });

  it('keeps the gutter for a loading screen in an edge-to-edge shell, and the initial beside it', () => {
    renderIn(
      <PlayerShell tabs={PLAYER_TABS} currentTab="home" avatar={{ initial: 'I', href: '/profile' }} isFullBleed>
        <Screen title="Tonight" isTitleHidden status="error" errorText="Couldn't load tonight." />
      </PlayerShell>,
    );
    expect(screen.getByRole('link', { name: 'Profile' }).parentElement).toHaveClass('px-5');
    expect(screen.getByText("Couldn't load tonight.").closest('.px-5')).not.toBeNull();
  });

  it('hides the tab bar on a pushed screen', () => {
    renderShell({ isTabBarHidden: true });
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
  });

  it('keeps a screen\'s dock above the tab bar', () => {
    renderIn(
      <PlayerShell tabs={PLAYER_TABS} currentTab="home">
        <h1>Tonight</h1>
        <PlayerDock><button type="button">All tables</button></PlayerDock>
      </PlayerShell>,
    );
    const dock = screen.getByRole('button', { name: 'All tables' });
    expect(screen.getByRole('main')).not.toContainElement(dock);
    expect(dock.compareDocumentPosition(screen.getByRole('navigation'))).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  });

  it('takes the focus to the screen on Skip to content (F5-03)', async () => {
    renderShell();
    await userEvent.tab();
    expect(screen.getByRole('link', { name: 'Skip to content' })).toHaveFocus();
    await userEvent.keyboard('{Enter}');
    expect(screen.getByRole('main')).toHaveFocus();
  });

  it('has no accessibility violations', async () => {
    const { container } = renderShell();
    expect(await axeViolations(container)).toEqual([]);
  });
});
