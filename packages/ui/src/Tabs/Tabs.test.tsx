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

  it('draws words over a hairline unless asked otherwise', () => {
    renderIn(<Tabs label="Tournaments" tabs={TABS} current="list" />);
    expect(screen.getByRole('list')).toHaveClass('border-b', 'border-hairline');
    expect(screen.getByRole('link', { name: 'Tournaments' })).toHaveClass('border-b-2', 'border-action', 'text-16');
  });

  it('draws the console\'s pills: no hairline, the current one on a faint fill, 32 px at a desk and 44 below', () => {
    renderIn(<Tabs label="Waitlist" look="pill" tabs={TABS} current="templates" />);
    const list = screen.getByRole('list');
    expect(list).toHaveClass('gap-1');
    expect(list).not.toHaveClass('border-b');
    const current = screen.getByRole('link', { name: 'Templates' });
    expect(current).toHaveAttribute('aria-current', 'page');
    expect(current).toHaveClass('bg-subtle-hover', 'text-content', 'font-medium', 'rounded-md', 'px-3', 'text-13', 'min-h-touch', 'tablet:min-h-8');
    expect(current).not.toHaveClass('border-b-2');
    expect(screen.getByRole('link', { name: 'Structures' })).toHaveClass('text-content-muted', 'hover:text-content');
    expect(screen.getByRole('link', { name: 'Structures' })).not.toHaveClass('bg-subtle-hover');
  });

  it('routes a pill through the app, without accessibility violations', async () => {
    const onNavigate = vi.fn();
    const { container } = renderIn(<Tabs label="Waitlist" look="pill" tabs={TABS} current="list" onNavigate={onNavigate} />);
    await userEvent.click(screen.getByRole('link', { name: 'Templates' }));
    expect(onNavigate).toHaveBeenCalledWith('/tournaments?tab=templates');
    expect(await axeViolations(container)).toEqual([]);
  });
});
