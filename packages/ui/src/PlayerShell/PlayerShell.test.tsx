import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { PLAYER_TABS } from '../storybook/fixtures.ts';
import { axeViolations, renderIn } from '../test/render.tsx';
import { PlayerShell } from './PlayerShell.tsx';

function renderShell(props: { isTabBarHidden?: boolean; dock?: ReactNode } = {}) {
  return renderIn(
    <PlayerShell tabs={PLAYER_TABS} currentTab="home" onNavigate={vi.fn()} {...props}>
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

  it('hides the tab bar on a pushed screen, and keeps the dock above it', () => {
    const { rerender } = renderShell({ isTabBarHidden: true });
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
    rerender(
      <PlayerShell tabs={PLAYER_TABS} currentTab="home" dock={<button type="button">All tables</button>}>
        <h1>Tonight</h1>
      </PlayerShell>,
    );
    const dock = screen.getByRole('button', { name: 'All tables' });
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
