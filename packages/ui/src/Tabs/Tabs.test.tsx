import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { axeViolations, renderIn } from '../test/render.tsx';
import { Tabs } from './Tabs.tsx';

const TABS = [
  { id: 'list', label: 'Tournaments', href: '/tournaments' },
  { id: 'templates', label: 'Templates', href: '/tournaments?tab=templates' },
  { id: 'structures', label: 'Structures', href: '/tournaments?tab=structures' },
];

describe('Tabs', () => {
  it('lists the parts as links in a named navigation, marking the one shown', () => {
    renderIn(<Tabs label="Tournaments" tabs={TABS} current="templates" />);
    const nav = screen.getByRole('navigation', { name: 'Tournaments' });
    expect(nav).toContainElement(screen.getByRole('link', { name: 'Templates' }));
    expect(screen.getByRole('link', { name: 'Templates' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Structures' })).not.toHaveAttribute('aria-current');
  });

  it('routes a part through the app', async () => {
    const onNavigate = vi.fn();
    renderIn(<Tabs label="Tournaments" tabs={TABS} current="list" onNavigate={onNavigate} />);
    await userEvent.click(screen.getByRole('link', { name: 'Structures' }));
    expect(onNavigate).toHaveBeenCalledWith('/tournaments?tab=structures');
  });

  it('has no accessibility violations', async () => {
    const { container } = renderIn(<Tabs label="Tournaments" tabs={TABS} current="list" />);
    expect(await axeViolations(container)).toEqual([]);
  });
});
