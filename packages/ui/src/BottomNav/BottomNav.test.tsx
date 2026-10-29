import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { axeViolations, renderIn } from '../test/render.tsx';
import { BottomNav, type BottomNavItem, type PlayerTab } from './BottomNav.tsx';

function tabs(overrides: Partial<Record<PlayerTab, BottomNavItem['access']>> = {}): BottomNavItem[] {
  return (['home', 'sessions', 'food', 'rewards', 'learn'] as const).map((tab) => ({
    tab,
    href: `/${tab}`,
    access: overrides[tab] ?? { state: 'enabled' },
  }));
}

describe('BottomNav', () => {
  it('lists the five tabs in order inside a named navigation landmark', () => {
    renderIn(<BottomNav items={tabs()} current="home" />);
    const nav = screen.getByRole('navigation', { name: 'Main' });
    const names = within(nav).getAllByRole('link').map((link) => link.textContent);
    expect(names).toEqual(['Home', 'Sessions', 'Menu', 'Rewards', 'Learn']);
  });

  it('marks the current tab as the current page', () => {
    renderIn(<BottomNav items={tabs()} current="food" />);
    expect(screen.getByRole('link', { name: 'Menu' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Home' })).not.toHaveAttribute('aria-current');
  });

  it('leaves out a hidden tab', () => {
    renderIn(<BottomNav items={tabs({ learn: { state: 'hidden' } })} />);
    expect(screen.queryByRole('link', { name: 'Learn' })).not.toBeInTheDocument();
    expect(screen.getAllByRole('link')).toHaveLength(4);
  });

  it('keeps a locked tab and describes which tiers have it', () => {
    renderIn(<BottomNav items={tabs({ learn: { state: 'locked', tiers: ['Academy graduate', 'Black card'] } })} />);
    expect(screen.getByRole('link', { name: 'Learn' })).toHaveAccessibleDescription('Academy graduate and Black card only.');
  });

  it('describes a tab taken from this member alone as not on their account, naming no tier', () => {
    renderIn(<BottomNav items={tabs({ learn: { state: 'locked', tiers: [] } })} />);
    expect(screen.getByRole('link', { name: 'Learn' })).toHaveAccessibleDescription('Not available on your account. Ask the club.');
  });

  it('hands a plain click to the router instead of reloading the page', async () => {
    const onNavigate = vi.fn();
    renderIn(<BottomNav items={tabs()} onNavigate={onNavigate} />);
    await userEvent.click(screen.getByRole('link', { name: 'Rewards' }));
    expect(onNavigate).toHaveBeenCalledWith('/rewards');
  });

  it('can be walked with Tab and followed with Enter', async () => {
    const onNavigate = vi.fn();
    renderIn(<BottomNav items={tabs()} onNavigate={onNavigate} />);
    await userEvent.tab();
    await userEvent.tab();
    expect(screen.getByRole('link', { name: 'Sessions' })).toHaveFocus();
    await userEvent.keyboard('{Enter}');
    expect(onNavigate).toHaveBeenCalledWith('/sessions');
  });

  it('has no accessibility violations with a locked tab', async () => {
    const { container } = renderIn(<BottomNav items={tabs({ learn: { state: 'locked', tiers: ['Black card'] } })} current="home" />);
    expect(await axeViolations(container)).toEqual([]);
  });
});
