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

  it("starts at the dealer's left and runs clockwise, so seat 1 and the last flank the tray at the foot, as on the felt (F-190)", () => {
    const { container } = renderIn(<SeatRing name="Table 1" stakes="50/100" seats={SEATS} label="Table 1" />);
    const [first, second, last] = [...container.querySelectorAll('circle')].map((seat) => ({ x: Number(seat.getAttribute('cx')), y: Number(seat.getAttribute('cy')) }));
    expect(first?.x).toBeLessThan(120);
    expect(first?.y).toBeGreaterThan(75);
    expect(last?.x).toBeCloseTo(240 - (first?.x ?? 0));
    expect(last?.y).toBeCloseTo(first?.y ?? 0);
    expect(second?.y).toBeCloseTo(15);
  });

  it('shows a seat to watch with a ring of its own and a short word, and says so to a screen reader (F-189)', () => {
    const { container } = renderIn(<SeatRing name="Table 3" stakes="100/200" label="Table 3" onSelectSeat={() => undefined} seats={[
      { number: 1, initials: 'RV', name: 'Rahul Verma', status: { kind: 'leaving', label: 'Leaving' } },
      { number: 2, initials: 'NB', name: 'Neha Bose' },
      { number: 3, initials: 'AK', name: 'Arjun Kapoor', status: { kind: 'away', label: 'Away' } },
    ]} />);
    expect(screen.getByText('Leaving')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Seat 1, Rahul Verma, Leaving' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Seat 2, Neha Bose' })).toBeInTheDocument();
    const [leaving, plain, away] = [...container.querySelectorAll('circle')];
    expect(leaving).toHaveClass('stroke-alert');
    expect(plain).toHaveClass('stroke-cream');
    expect(away).toHaveAttribute('stroke-dasharray');
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
    // An open seat's circle says its number; a taken one's number sits beside it, off the felt (UI-14).
    expect(screen.queryByText('Seat 2')).toBeNull();
    expect(screen.getByText('Seat 1')).toBeInTheDocument();
  });

  it('has no accessibility violations', async () => {
    const { container } = renderIn(<SeatRing name="Table 1" stakes="50/100" seats={SEATS} label="Table 1, 2 of 3 seats taken" />);
    expect(await axeViolations(container)).toEqual([]);
  });
});
