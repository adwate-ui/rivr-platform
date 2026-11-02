import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { PLAYER_TABS } from '../storybook/fixtures.ts';
import { axeViolations, renderIn } from '../test/render.tsx';
import { PlayerDock, PlayerShell } from './PlayerShell.tsx';

function renderShell(props: { isTabBarHidden?: boolean; onNavigate?: () => void } = {}) {
  return renderIn(
    <PlayerShell tabs={PLAYER_TABS} currentTab="home" avatar={{ initial: 'I', href: '/profile' }} {...props}>
      <h1>Tonight</h1>
    </PlayerShell>,
  );
}

describe('PlayerShell', () => {
  it('puts the screen in the main landmark and the tabs in navigation', () => {
    renderShell();
    expect(screen.getByRole('main')).toHaveTextContent('Tonight');
    expect(screen.getByRole('navigation', { name: 'Main' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Tonight' })).toHaveAttribute('aria-current', 'page');
  });

  it('opens Profile from the member initial, top right', async () => {
    const onNavigate = vi.fn();
    renderShell({ onNavigate });
    await userEvent.click(screen.getByRole('link', { name: 'Profile' }));
    expect(onNavigate).toHaveBeenCalledWith('/profile');
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
