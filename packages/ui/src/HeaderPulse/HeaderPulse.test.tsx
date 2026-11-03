import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { axeViolations, renderIn } from '../test/render.tsx';
import { HeaderPulse, type PulseCount } from './HeaderPulse.tsx';

const items: PulseCount[] = [
  { id: 'seated', count: 23, label: 'seated', href: '#floor' },
  { id: 'requests', count: 6, label: 'requests', href: '#requests', needsYou: true },
];

describe('HeaderPulse', () => {
  it('is a named navigation of counts, each a link named by its count and what it counts', () => {
    renderIn(<HeaderPulse label="Tonight" items={items} />);
    expect(screen.getByRole('navigation', { name: 'Tonight' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '23 seated' })).toHaveAttribute('href', '#floor');
    expect(screen.getByRole('link', { name: '6 requests' })).toBeInTheDocument();
  });

  it('puts a gold dot before a count that needs the staff member while it is above 0 (decision 0429)', () => {
    const { container, rerender } = renderIn(<HeaderPulse label="Tonight" items={items} />);
    expect(container.querySelectorAll('.bg-action')).toHaveLength(1);
    rerender(<HeaderPulse label="Tonight" items={[{ id: 'requests', count: 0, label: 'requests', href: '#requests', needsYou: true }]} />);
    expect(container.querySelectorAll('.bg-action')).toHaveLength(0);
  });

  it('opens a count\'s screen through the app, from a click or Enter', async () => {
    const onNavigate = vi.fn();
    renderIn(<HeaderPulse label="Tonight" items={items} onNavigate={onNavigate} />);
    await userEvent.click(screen.getByRole('link', { name: '23 seated' }));
    expect(onNavigate).toHaveBeenLastCalledWith('#floor');
    await userEvent.tab();
    expect(screen.getByRole('link', { name: '6 requests' })).toHaveFocus();
    await userEvent.keyboard('{Enter}');
    expect(onNavigate).toHaveBeenLastCalledWith('#requests');
  });

  it('has no accessibility violations', async () => {
    const { container } = renderIn(<HeaderPulse label="Tonight" items={items} />);
    expect(await axeViolations(container)).toEqual([]);
  });
});
