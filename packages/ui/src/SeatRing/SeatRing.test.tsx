import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { axeViolations, renderIn } from '../test/render.tsx';
import { SeatRing } from './SeatRing.tsx';

const SEATS = [
  { number: 1, initials: 'RV' },
  { number: 2, initials: null },
  { number: 3, initials: 'NB' },
];

describe('SeatRing', () => {
  it('is one image named by its summary, with the table and every seat drawn', () => {
    const { container } = renderIn(<SeatRing name="Table 1" stakes="50/100" seats={SEATS} label="Table 1, 2 of 3 seats taken" />);
    expect(screen.getByRole('img', { name: 'Table 1, 2 of 3 seats taken' })).toBeInTheDocument();
    expect(container.querySelectorAll('circle')).toHaveLength(3);
    expect(screen.getByText('Table 1')).toBeInTheDocument();
    expect(screen.getByText('50/100')).toBeInTheDocument();
  });

  it('shows who sits in a seat, and the number of an open one', () => {
    renderIn(<SeatRing name="Table 1" stakes="50/100" seats={SEATS} label="Table 1" />);
    expect(screen.getByText('RV')).toBeInTheDocument();
    expect(screen.getByText('NB')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('puts seat 1 at the top and the rest clockwise', () => {
    const { container } = renderIn(<SeatRing name="Table 1" stakes="50/100" seats={SEATS} label="Table 1" />);
    const [first, second] = [...container.querySelectorAll('circle')].map((seat) => ({ x: Number(seat.getAttribute('cx')), y: Number(seat.getAttribute('cy')) }));
    expect(first).toEqual({ x: 120, y: 15 });
    expect(second?.x).toBeGreaterThan(120);
  });

  it('on the tablet, makes each seat a button named by its player, chosen by click or keyboard', async () => {
    const onSelectSeat = vi.fn();
    renderIn(<SeatRing name="Table 3" stakes="100/200" label="Table 3" selectedSeat={3} onSelectSeat={onSelectSeat}
      seats={[{ number: 1, initials: 'RV', name: 'Rahul Verma' }, { number: 2, initials: null }, { number: 3, initials: 'NB', name: 'Neha Bose' }]} />);
    expect(screen.getByRole('group', { name: 'Table 3' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Seat 3, Neha Bose' })).toHaveAttribute('aria-pressed', 'true');
    await userEvent.click(screen.getByRole('button', { name: 'Seat 1, Rahul Verma' }));
    screen.getByRole('button', { name: 'Seat 2, open' }).focus();
    await userEvent.keyboard('{Enter}');
    expect(onSelectSeat.mock.calls).toEqual([[1], [2]]);
    expect(screen.getByText('Seat 2')).toBeInTheDocument();
  });

  it('has no accessibility violations', async () => {
    const { container } = renderIn(<SeatRing name="Table 1" stakes="50/100" seats={SEATS} label="Table 1, 2 of 3 seats taken" />);
    expect(await axeViolations(container)).toEqual([]);
  });
});
