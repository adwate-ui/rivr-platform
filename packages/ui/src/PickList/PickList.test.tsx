import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { axeViolations, renderIn } from '../test/render.tsx';
import { PickList } from './PickList.tsx';

const CHECKS = [
  { label: 'To review', count: 2, items: [{ id: 'r1', title: 'Rohan Bhatia', detail: 'PAN alone · 11:42' }, { id: 'r2', title: 'Naina Kapoor' }] },
  { label: 'Waiting on the member', count: 1, items: [{ id: 'w1', title: 'Puneet Agarwal', detail: 'Needs a PAN' }] },
];

describe('PickList', () => {
  it('lists each group under its heading and count, each item a button with its line', () => {
    renderIn(<PickList label="Checks" groups={CHECKS} current={null} onPick={vi.fn()} emptyText="Nothing to check." />);
    expect(screen.getByRole('heading', { name: 'To review' })).toBeInTheDocument();
    expect(screen.getByRole('list', { name: 'To review' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Rohan Bhatia/ })).toHaveTextContent('PAN alone · 11:42');
    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('marks the item open as current, on the chosen fill', () => {
    renderIn(<PickList label="Checks" groups={CHECKS} current="r2" onPick={vi.fn()} emptyText="Nothing to check." />);
    expect(screen.getByRole('button', { name: 'Naina Kapoor' })).toHaveAttribute('aria-current', 'true');
    expect(screen.getByRole('button', { name: 'Naina Kapoor' })).toHaveClass('bg-selected');
    expect(screen.getByRole('button', { name: /^Rohan Bhatia/ })).not.toHaveAttribute('aria-current');
  });

  it('picks an item by click or from the keyboard', async () => {
    const onPick = vi.fn();
    renderIn(<PickList label="Checks" groups={CHECKS} current={null} onPick={onPick} emptyText="Nothing to check." />);
    await userEvent.click(screen.getByRole('button', { name: /^Puneet Agarwal/ }));
    expect(onPick).toHaveBeenCalledWith('w1');
    screen.getByRole('button', { name: /^Rohan Bhatia/ }).focus();
    await userEvent.keyboard('{Enter}');
    expect(onPick).toHaveBeenLastCalledWith('r1');
  });

  it('says so in one line when no group holds an item, and keeps a group without a heading unheaded', () => {
    renderIn(<PickList label="Pages" groups={[{ items: [] }]} current={null} onPick={vi.fn()} emptyText="No page matches." />);
    expect(screen.getByText('No page matches.')).toBeInTheDocument();
    expect(screen.queryByRole('heading')).toBeNull();
  });

  it('holds what it is given above the items, such as a search field', () => {
    renderIn(<PickList label="Pages" groups={[{ items: [{ id: 'p1', title: 'About' }] }]} current={null} onPick={vi.fn()} emptyText="None."
      search={<label>Find a page<input /></label>} />);
    expect(screen.getByRole('textbox', { name: 'Find a page' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Pages' })).toBeInTheDocument();
  });

  it('has no accessibility violations', async () => {
    const { container } = renderIn(<PickList label="Checks" groups={CHECKS} current="r1" onPick={vi.fn()} emptyText="Nothing to check." />);
    expect(await axeViolations(container)).toEqual([]);
  });
});
