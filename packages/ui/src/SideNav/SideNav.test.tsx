import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { axeViolations, renderIn } from '../test/render.tsx';
import { SideNav, type SideNavSection } from './SideNav.tsx';

const sections: SideNavSection[] = [
  {
    id: 'floor',
    label: 'Floor',
    items: [
      { id: 'liveFloor', label: 'Live floor', href: '#floor' },
      { id: 'waitlist', label: 'Waitlist', href: '#waitlist' },
    ],
  },
  { id: 'money', label: 'Money', items: [{ id: 'cage', label: 'Cage', href: '#cage' }] },
  { id: 'reports', items: [{ id: 'reports', label: 'Reports', href: '#reports' }] },
];

describe('SideNav', () => {
  it('shows a section without a heading as its links alone, so Reports appears once', () => {
    renderIn(<SideNav label="Sections" sections={sections} />);
    expect(screen.getAllByText('Reports')).toHaveLength(1);
    expect(screen.getByRole('link', { name: 'Reports' })).toBeInTheDocument();
  });

  it('is a named navigation landmark with one list per section, named by its heading', () => {
    renderIn(<SideNav label="Sections" sections={sections} />);
    const nav = screen.getByRole('navigation', { name: 'Sections' });
    expect(within(nav).getByRole('list', { name: 'Floor' })).toBeInTheDocument();
    expect(within(nav).getByRole('list', { name: 'Money' })).toBeInTheDocument();
    expect(within(nav).getAllByRole('link').map((link) => link.textContent)).toEqual(['Live floor', 'Waitlist', 'Cage', 'Reports']);
  });

  it('shows how many wait on an entry\'s screen, read with its name, and nothing for none', () => {
    renderIn(<SideNav label="Sections" sections={[{ id: 'growth', label: 'Growth', items: [
      { id: 'highHands', label: 'High hands', href: '#high-hands', count: 2 },
      { id: 'jackpots', label: 'Jackpots', href: '#jackpots', count: 0 },
    ] }]} />);
    expect(screen.getByRole('link', { name: 'High hands', description: '2 waiting' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Jackpots' })).toHaveTextContent(/^Jackpots$/);
  });

  it('marks the current screen', () => {
    renderIn(<SideNav label="Sections" sections={sections} current="cage" />);
    expect(screen.getByRole('link', { name: 'Cage' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Waitlist' })).not.toHaveAttribute('aria-current');
  });

  it('routes a click through the app and follows Enter from the keyboard', async () => {
    const onNavigate = vi.fn();
    renderIn(<SideNav label="Sections" sections={sections} onNavigate={onNavigate} />);
    await userEvent.click(screen.getByRole('link', { name: 'Waitlist' }));
    expect(onNavigate).toHaveBeenLastCalledWith('#waitlist');
    await userEvent.tab();
    await userEvent.keyboard('{Enter}');
    expect(onNavigate).toHaveBeenLastCalledWith('#cage');
  });

  it('leaves a modified click to the browser', async () => {
    const onNavigate = vi.fn();
    renderIn(<SideNav label="Sections" sections={sections} onNavigate={onNavigate} />);
    const user = userEvent.setup();
    await user.keyboard('{Control>}');
    await user.click(screen.getByRole('link', { name: 'Cage' }));
    expect(onNavigate).not.toHaveBeenCalled();
  });

  it('has no accessibility violations', async () => {
    const { container } = renderIn(<SideNav label="Sections" sections={sections} current="liveFloor" />);
    expect(await axeViolations(container)).toEqual([]);
  });

  it('outlines a waiting count rather than filling it gold, and rules the current screen in gold', () => {
    renderIn(<SideNav label="Sections" current="waitlist" sections={[{ id: 'tonight', items: [{ id: 'waitlist', label: 'Waitlist', href: '/waitlist', count: 3 }] }]} />);
    const count = screen.getByText('3');
    expect(count).not.toHaveClass('bg-action');
    expect(count).toHaveClass('border-action');
    expect(screen.getByRole('link', { name: /Waitlist/ })).toHaveClass('border-action');
  });

  it('fills an urgent count red, such as top-ups waiting (decision 0299)', () => {
    renderIn(<SideNav label="Sections" current="liveFloor" sections={[{ id: 'tonight', items: [
      { id: 'topUps', label: 'Top-ups', href: '/top-ups', count: 2, isUrgent: true }] }]} />);
    expect(screen.getByText('2')).toHaveClass('bg-alert', 'text-on-alert');
    // The link keeps its name; how many wait is its description (decision 0301).
    expect(screen.getByRole('link', { name: 'Top-ups', description: '2 waiting' })).toBeDefined();
  });
});
