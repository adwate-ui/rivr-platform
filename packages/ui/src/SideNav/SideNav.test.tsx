import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { axeViolations, renderIn } from '../test/render.tsx';
import { SideNav, type SideNavSection } from './SideNav.tsx';

const sections: SideNavSection[] = [
  {
    id: 'tonight',
    label: 'Tonight',
    items: [
      { id: 'floor', label: 'Live floor', href: '#floor', icon: 'floor', count: 9, isActionable: true },
      { id: 'waitlist', label: 'Waitlist', href: '#waitlist', icon: 'waitlist' },
    ],
  },
  { id: 'players', label: 'Players', items: [{ id: 'kyc', label: 'KYC review', href: '#kyc', icon: 'kyc', count: 2 }] },
  { id: 'single', items: [{ id: 'members', label: 'Members', href: '#members', icon: 'profile' }] },
  {
    id: 'admin', label: 'Admin', isCollapsible: true, items: [
      { id: 'staff', label: 'Staff', href: '#staff', icon: 'staff' },
      { id: 'purge', label: 'Purge', href: '#purge', icon: 'purge', tone: 'danger' },
    ],
  },
];

describe('SideNav', () => {
  it('is a named navigation landmark with one list per group, named by its heading', () => {
    renderIn(<SideNav label="Sections" sections={sections} />);
    const nav = screen.getByRole('navigation', { name: 'Sections' });
    expect(within(nav).getByRole('list', { name: 'Tonight' })).toBeInTheDocument();
    expect(within(nav).getAllByRole('link').map((link) => link.getAttribute('href'))).toEqual(['#floor', '#waitlist', '#kyc', '#members']);
  });

  it('shows a group without a heading as its links alone, so its name appears once', () => {
    renderIn(<SideNav label="Sections" sections={sections} />);
    expect(screen.getAllByText('Members')).toHaveLength(1);
  });

  it('keeps a link\'s name its label and reads how many wait as its description', () => {
    renderIn(<SideNav label="Sections" sections={sections} />);
    expect(screen.getByRole('link', { name: 'Live floor', description: '9 waiting' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Waitlist' })).not.toHaveAttribute('aria-describedby');
  });

  it('fills an actionable count gold and an informational one muted (decision 0429)', () => {
    renderIn(<SideNav label="Sections" sections={sections} />);
    expect(screen.getByText('9')).toHaveClass('bg-action', 'text-on-action');
    expect(screen.getByText('2')).toHaveClass('bg-cream-track', 'text-content');
    expect(screen.getByText('2')).not.toHaveClass('bg-action');
  });

  it('marks the current screen on a faint fill', () => {
    renderIn(<SideNav label="Sections" sections={sections} current="waitlist" />);
    expect(screen.getByRole('link', { name: 'Waitlist' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Waitlist' })).toHaveClass('bg-subtle-hover');
    expect(screen.getByRole('link', { name: /Live floor/ })).not.toHaveAttribute('aria-current');
  });

  it('folds a collapsible group shut behind its heading, and opens it from the keyboard', async () => {
    renderIn(<SideNav label="Sections" sections={sections} />);
    const heading = screen.getByRole('button', { name: 'Admin' });
    expect(heading).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('link', { name: 'Staff' })).toBeNull();
    heading.focus();
    await userEvent.keyboard('{Enter}');
    expect(heading).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('link', { name: 'Purge' })).toHaveClass('text-danger');
  });

  it('keeps a collapsible group open while its current screen is in it', () => {
    renderIn(<SideNav label="Sections" sections={sections} current="staff" />);
    expect(screen.getByRole('button', { name: 'Admin' })).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('link', { name: 'Staff' })).toHaveAttribute('aria-current', 'page');
  });

  it('folded to icons, shows every screen without headings, its name a tooltip and still read out, a count a dot', () => {
    renderIn(<SideNav label="Sections" sections={sections} isCollapsed />);
    expect(screen.queryByRole('button', { name: 'Admin' })).toBeNull();
    expect(screen.getByRole('list', { name: 'Admin' })).toBeInTheDocument();
    const floor = screen.getByRole('link', { name: 'Live floor', description: '9 waiting' });
    expect(floor).toHaveAttribute('title', 'Live floor');
    expect(screen.queryByText('9')).toBeNull();
    expect(screen.getByRole('link', { name: 'Purge' })).toBeInTheDocument();
  });

  it('routes a click through the app and follows Enter from the keyboard', async () => {
    const onNavigate = vi.fn();
    renderIn(<SideNav label="Sections" sections={sections} onNavigate={onNavigate} />);
    await userEvent.click(screen.getByRole('link', { name: 'Waitlist' }));
    expect(onNavigate).toHaveBeenLastCalledWith('#waitlist');
    await userEvent.tab();
    await userEvent.keyboard('{Enter}');
    expect(onNavigate).toHaveBeenLastCalledWith('#kyc');
  });

  it('leaves a modified click to the browser', async () => {
    const onNavigate = vi.fn();
    renderIn(<SideNav label="Sections" sections={sections} onNavigate={onNavigate} />);
    const user = userEvent.setup();
    await user.keyboard('{Control>}');
    await user.click(screen.getByRole('link', { name: 'Members' }));
    expect(onNavigate).not.toHaveBeenCalled();
  });

  it('has no accessibility violations, labelled or folded', async () => {
    const { container, rerender } = renderIn(<SideNav label="Sections" sections={sections} current="floor" />);
    expect(await axeViolations(container)).toEqual([]);
    rerender(<SideNav label="Sections" sections={sections} current="floor" isCollapsed />);
    expect(await axeViolations(container)).toEqual([]);
  });
});
