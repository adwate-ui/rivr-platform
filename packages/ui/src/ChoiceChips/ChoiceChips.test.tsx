import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { axeViolations, renderIn } from '../test/render.tsx';
import { ChoiceChips } from './ChoiceChips.tsx';

const GAMES = [
  { value: 'nlh', label: 'NLH' },
  { value: 'plo', label: 'PLO' },
  { value: 'tournaments', label: 'Tournaments' },
] as const;

describe('ChoiceChips', () => {
  it('is a group named by its label, each chip saying whether it is chosen', () => {
    renderIn(<ChoiceChips label="Games" options={GAMES} selected={['plo']} onChange={() => undefined} />);

    expect(screen.getByRole('group', { name: 'Games' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'PLO' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'NLH' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('adds and removes choices when many may be chosen', async () => {
    const onChange = vi.fn();
    renderIn(<ChoiceChips label="Games" options={GAMES} selected={['plo']} onChange={onChange} />);

    await userEvent.click(screen.getByRole('button', { name: 'NLH' }));
    await userEvent.click(screen.getByRole('button', { name: 'PLO' }));

    expect(onChange.mock.calls).toEqual([[['plo', 'nlh']], [[]]]);
  });

  it('is a radio group when one may be chosen, and keeps the chosen chip when it is pressed again', async () => {
    const onChange = vi.fn();
    renderIn(<ChoiceChips label="Stake" mode="one" options={GAMES} selected={['plo']} onChange={onChange} />);

    expect(screen.getByRole('radiogroup', { name: 'Stake' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'PLO' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('radio', { name: 'NLH' })).toHaveAttribute('aria-checked', 'false');
    await userEvent.click(screen.getByRole('radio', { name: 'NLH' }));
    await userEvent.click(screen.getByRole('radio', { name: 'PLO' }));

    expect(onChange.mock.calls).toEqual([[['nlh']]]);
  });

  it('moves between the choices with the arrow keys and chooses them, round at the ends', async () => {
    const onChange = vi.fn();
    renderIn(<ChoiceChips label="Stake" mode="one" options={GAMES} selected={['plo']} onChange={onChange} />);

    await userEvent.tab();
    expect(screen.getByRole('radio', { name: 'PLO' })).toHaveFocus();
    await userEvent.keyboard('{ArrowRight}');
    expect(screen.getByRole('radio', { name: 'Tournaments' })).toHaveFocus();
    await userEvent.keyboard('{ArrowDown}');
    expect(screen.getByRole('radio', { name: 'NLH' })).toHaveFocus();
    await userEvent.keyboard('{ArrowLeft}{End}{Home}');

    expect(onChange.mock.calls).toEqual([[['tournaments']], [['nlh']], [['tournaments']], [['tournaments']], [['nlh']]]);
  });

  it('puts only the chosen chip in the Tab order, or the first when none is chosen', () => {
    const { rerender } = renderIn(<ChoiceChips label="Stake" mode="one" options={GAMES} selected={['plo']} onChange={() => undefined} />);
    expect(screen.getAllByRole('radio').map((chip) => chip.tabIndex)).toEqual([-1, 0, -1]);
    rerender(<ChoiceChips label="Stake" mode="one" options={GAMES} selected={[]} onChange={() => undefined} />);
    expect(screen.getAllByRole('radio').map((chip) => chip.tabIndex)).toEqual([0, -1, -1]);
  });

  it('has no accessibility violations as a radio group', async () => {
    const { container } = renderIn(<ChoiceChips label="Stake" mode="one" options={GAMES} selected={['nlh']} onChange={() => undefined} />);
    expect(await axeViolations(container)).toEqual([]);
  });

  it('is reached with Tab and pressed with Space', async () => {
    const onChange = vi.fn();
    renderIn(<ChoiceChips label="Games" options={GAMES} selected={[]} onChange={onChange} />);

    await userEvent.tab();
    expect(screen.getByRole('button', { name: 'NLH' })).toHaveFocus();
    await userEvent.keyboard(' ');

    expect(onChange).toHaveBeenCalledWith(['nlh']);
  });

  it('ignores presses while disabled', async () => {
    const onChange = vi.fn();
    renderIn(<ChoiceChips label="Games" options={GAMES} selected={[]} onChange={onChange} isDisabled />);

    await userEvent.click(screen.getByRole('button', { name: 'NLH' }));

    expect(onChange).not.toHaveBeenCalled();
  });

  it('keeps a visually hidden label as the group\'s name for screen readers', async () => {
    const { container } = renderIn(<ChoiceChips label="Learn library for Member" options={GAMES} selected={[]} onChange={() => undefined} isLabelVisuallyHidden />);

    expect(screen.getByRole('group', { name: 'Learn library for Member' })).toBeInTheDocument();
    expect(screen.getByText('Learn library for Member')).toHaveClass('sr-only');
    expect(await axeViolations(container)).toEqual([]);
  });

  it('keeps a filter in one row that scrolls, its chips whole, when asked', () => {
    renderIn(<ChoiceChips label="Show" mode="one" options={GAMES} selected={[]} onChange={() => undefined} isOneRow />);
    const group = screen.getByRole('radiogroup', { name: 'Show' });
    expect(group).toHaveAttribute('data-chip-row');
    expect(group).toHaveClass('overflow-x-auto');
    expect(group).not.toHaveClass('flex-wrap');
    expect(screen.getAllByRole('radio')[0]).toHaveClass('shrink-0', 'whitespace-nowrap');
  });

  it('has no accessibility violations', async () => {
    const { container } = renderIn(<ChoiceChips label="Games" options={GAMES} selected={['nlh']} onChange={() => undefined} />);
    expect(await axeViolations(container)).toEqual([]);
  });

  it('draws the redesign\'s pills and tiles, the picked one in gold tint (decision 0320)', () => {
    const lengths = [{ value: '30', label: '30 min' }, { value: '60', label: '1 hour' }, { value: '120', label: '2 hours' }];
    const { rerender } = renderIn(<ChoiceChips label="Add time" look="tile" mode="one" options={lengths} selected={['60']} onChange={() => undefined} />);
    expect(screen.getByRole('radio', { name: '1 hour' })).toHaveClass('h-tile', 'bg-gold-tint');
    expect(screen.getByRole('radiogroup', { name: 'Add time' })).toHaveClass('grid-cols-3');
    rerender(<ChoiceChips label="Filter" look="pill" mode="one" options={lengths} selected={['30']} onChange={() => undefined} />);
    expect(screen.getByRole('radio', { name: '30 min' })).toHaveClass('rounded-full', 'border-gold');
    expect(screen.getByRole('radio', { name: '2 hours' })).toHaveClass('border-control');
  });

  it('underlines the chosen category in gold as tabs (decision 0320)', () => {
    renderIn(<ChoiceChips label="Menu" look="tabs" mode="one" options={[{ value: 'food', label: 'Food' }, { value: 'bar', label: 'Bar' }]}
      selected={['food']} onChange={() => undefined} />);
    expect(screen.getByRole('radio', { name: 'Food' })).toHaveClass('border-gold', 'border-b-2');
    expect(screen.getByRole('radio', { name: 'Bar' })).toHaveClass('border-transparent');
  });

  it('draws the console\'s subtle chips: a faint cream fill, the chosen one gold-tinted, 34 px at a desk and 44 below', () => {
    renderIn(<ChoiceChips label="Status" look="subtle" mode="one" options={GAMES} selected={['plo']} onChange={() => undefined} />);
    const chosen = screen.getByRole('radio', { name: 'PLO' });
    const other = screen.getByRole('radio', { name: 'NLH' });
    expect(chosen).toHaveClass('bg-selected', 'text-content', 'rounded-md', 'text-13', 'min-h-touch', 'tablet:min-h-row-compact', 'items-center', 'leading-control');
    expect(chosen).not.toHaveClass('bg-subtle');
    expect(other).toHaveClass('bg-subtle', 'text-content');
    expect(other).not.toHaveClass('text-content-muted', 'border');
  });

  it('shows a chip\'s count after its label and reads it as part of its name', async () => {
    const onChange = vi.fn();
    const statuses = [{ value: 'pending', label: 'Pending', count: 3 }, { value: 'done', label: 'Done', count: 0 }, { value: 'all', label: 'All' }];
    const { container } = renderIn(<ChoiceChips label="Status" look="subtle" mode="one" options={statuses} selected={['all']} onChange={onChange} />);
    const pending = screen.getByRole('radio', { name: 'Pending, 3' });
    expect(pending).toHaveTextContent('Pending3');
    // Cream like its label, never muted on the fill; set apart by its weight beside a chosen label.
    expect(pending).toHaveClass('text-content');
    expect(screen.getByText('3')).toHaveClass('font-regular');
    expect(screen.getByText('3')).not.toHaveClass('text-content-muted');
    expect(screen.getByRole('radio', { name: 'Done, 0' })).toHaveAttribute('aria-checked', 'false');
    expect(screen.getByRole('radio', { name: 'All' })).toHaveAttribute('aria-checked', 'true');
    await userEvent.click(pending);
    expect(onChange).toHaveBeenCalledWith(['pending']);
    expect(await axeViolations(container)).toEqual([]);
  });
});
