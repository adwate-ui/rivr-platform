import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
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

  it('has no accessibility violations', async () => {
    const { container } = renderIn(<SeatRing name="Table 1" stakes="50/100" seats={SEATS} label="Table 1, 2 of 3 seats taken" />);
    expect(await axeViolations(container)).toEqual([]);
  });
});
