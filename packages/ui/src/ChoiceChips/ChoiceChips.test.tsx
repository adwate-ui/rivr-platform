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

  it('keeps one choice when one may be chosen, and clears it when pressed again', async () => {
    const onChange = vi.fn();
    renderIn(<ChoiceChips label="Stake" mode="one" options={GAMES} selected={['plo']} onChange={onChange} />);

    await userEvent.click(screen.getByRole('button', { name: 'NLH' }));
    await userEvent.click(screen.getByRole('button', { name: 'PLO' }));

    expect(onChange.mock.calls).toEqual([[['nlh']], [[]]]);
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

  it('has no accessibility violations', async () => {
    const { container } = renderIn(<ChoiceChips label="Games" options={GAMES} selected={['nlh']} onChange={() => undefined} />);
    expect(await axeViolations(container)).toEqual([]);
  });
});
