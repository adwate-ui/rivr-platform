import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { axeViolations, renderIn } from '../test/render.tsx';
import { StakeValues, type StakeValue } from './StakeValues.tsx';

// The Private Room is new: it has no call time yet.
const STAKES: readonly StakeValue[] = [
  { id: 's1', name: 'NLH 50/100', value: 3 },
  { id: 's2', name: 'NLH 100/200/500', value: 4 },
  { id: 's3', name: 'Private Room', value: null },
];

/** Each stake's call time, of 1 to 12 hours. */
function callTimes(stakes: readonly StakeValue[] = STAKES) {
  const onChange = vi.fn();
  const drawn = renderIn(<StakeValues label="Call time" stakes={stakes} unit="hours" min={1} max={12} onChange={onChange} />);
  return { onChange, ...drawn };
}

const field = (stake: string) => screen.getByRole('textbox', { name: stake });

describe('StakeValues', () => {
  it('gives every stake a field under its name, with its value and unit', async () => {
    const { container } = callTimes();
    expect(screen.getByRole('group', { name: 'Call time' })).toBeInTheDocument();
    expect(field('NLH 50/100')).toHaveValue('3');
    expect(field('NLH 100/200/500')).toHaveAccessibleDescription('hours');
    expect(await axeViolations(container)).toEqual([]);
  });

  it('keeps a line for a stake that has none, until it is given one', async () => {
    const { onChange } = callTimes();
    expect(field('Private Room')).toHaveValue('');
    expect(field('Private Room')).toHaveAccessibleDescription('hours Not set');
    await userEvent.type(field('Private Room'), '5');
    expect(field('Private Room')).toHaveAccessibleDescription('hours');
    expect(onChange).toHaveBeenLastCalledWith({ s1: 3, s2: 4, s3: 5 });
  });

  it('gives each stake its own value, null for one left with none', async () => {
    const { onChange } = callTimes();
    await userEvent.clear(field('NLH 50/100'));
    await userEvent.type(field('NLH 50/100'), '2');
    expect(onChange).toHaveBeenLastCalledWith({ s1: 2, s2: 4, s3: null });
    await userEvent.clear(field('NLH 100/200/500'));
    expect(onChange).toHaveBeenLastCalledWith({ s1: 2, s2: null, s3: null });
  });

  it('refuses a value outside the range, under its own stake, and gives nothing while it stands', async () => {
    const { onChange } = callTimes();
    await userEvent.clear(field('NLH 50/100'));
    await userEvent.type(field('NLH 50/100'), '13');
    expect(onChange).toHaveBeenLastCalledWith(null);
    expect(field('NLH 50/100')).toBeInvalid();
    expect(screen.getByRole('alert')).toHaveTextContent('Between 1 and 12 hours.');
    expect(field('NLH 100/200/500')).not.toBeInvalid();
    await userEvent.clear(field('NLH 50/100'));
    await userEvent.type(field('NLH 50/100'), '12');
    expect(onChange).toHaveBeenLastCalledWith({ s1: 12, s2: 4, s3: null });
  });

  it('says so in one line when the club has no stakes', () => {
    callTimes([]);
    expect(screen.getByText('No stakes yet.')).toBeInTheDocument();
    expect(screen.queryByRole('textbox')).toBeNull();
  });
});
