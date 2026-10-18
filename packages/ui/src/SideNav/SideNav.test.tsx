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
  { id: 'reports', label: 'Reports', items: [{ id: 'reports', label: 'Reports', href: '#reports' }] },
];

describe('SideNav', () => {
  it('is a named navigation landmark with one list per section, named by its heading', () => {
    renderIn(<SideNav label="Sections" sections={sections} />);
    const nav = screen.getByRole('navigation', { name: 'Sections' });
    expect(within(nav).getByRole('list', { name: 'Floor' })).toBeInTheDocument();
    expect(within(nav).getByRole('list', { name: 'Money' })).toBeInTheDocument();
    expect(within(nav).getAllByRole('link').map((link) => link.textContent)).toEqual(['Live floor', 'Waitlist', 'Cage', 'Reports']);
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
});
