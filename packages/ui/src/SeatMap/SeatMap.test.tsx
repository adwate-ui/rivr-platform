import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { axeViolations, renderIn } from '../test/render.tsx';
import { SeatMap, seatPosition } from './SeatMap.tsx';

describe('SeatMap', () => {
  it('is one picture named by how many seats are open', () => {
    renderIn(<SeatMap openSeats={[2, 4, 7]} label="3 of 9 seats open" />);
    expect(screen.getByRole('img', { name: '3 of 9 seats open' })).toBeInTheDocument();
  });

  it('numbers nine seats and marks the open ones', () => {
    const { container } = renderIn(<SeatMap openSeats={[2, 4, 7]} label="3 of 9 seats open" />);
    expect(container.querySelectorAll('[data-seat]')).toHaveLength(9);
    expect([...container.querySelectorAll('[data-open]')].map((seat) => seat.getAttribute('data-seat'))).toEqual(['2', '4', '7']);
  });

  it('places seat n at 270° plus n times 36° round the ellipse', () => {
    // Seat 5 is at 450°, straight below the centre; a tenth seat at 630°, straight above, in the dealer's gap.
    expect(seatPosition(5).x).toBeCloseTo(167, 5);
    expect(seatPosition(5).y).toBeCloseTo(85 + 71.4, 5);
    expect(seatPosition(10).x).toBeCloseTo(167, 5);
    expect(seatPosition(10).y).toBeCloseTo(85 - 71.4, 5);
  });

  it('has no accessibility violations', async () => {
    const { container } = renderIn(<SeatMap openSeats={[1]} label="1 of 9 seats open" />);
    expect(await axeViolations(container)).toEqual([]);
  });
});
