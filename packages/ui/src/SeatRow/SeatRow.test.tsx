import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { axeViolations, renderIn } from '../test/render.tsx';
import { SeatRow } from './SeatRow.tsx';

describe('SeatRow', () => {
  it('is one button for the whole row, read as the seat, who sits there and their call time', async () => {
    const onSelect = vi.fn();
    renderIn(<SeatRow number={1} name="Nakul Dhillon" meta="2 h 56 min" onSelect={onSelect} />);
    const row = screen.getByRole('button', { name: 'Seat 1, Nakul Dhillon, 2 h 56 min' });
    await userEvent.click(row);
    expect(onSelect).toHaveBeenCalledOnce();
  });

  it('shows what a player asks for with a gold dot, in place of the call time', () => {
    renderIn(<SeatRow number={2} name="Vidya Chadha" meta="2 h" request="Top-up" onSelect={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Seat 2, Vidya Chadha, Top-up' })).toBeInTheDocument();
    expect(screen.getByText('Top-up')).toHaveClass('text-gold');
    expect(screen.queryByText('2 h')).toBeNull();
  });

  it('says Open for an empty seat', () => {
    renderIn(<SeatRow number={3} onSelect={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Seat 3, Open' })).toBeInTheDocument();
  });

  it('is 44 px below 1180 px and 42 or 34 px at a desk, by density', () => {
    const { rerender } = renderIn(<SeatRow number={1} name="Nakul Dhillon" onSelect={vi.fn()} />);
    expect(screen.getByRole('button')).toHaveClass('min-h-touch', 'tablet:min-h-row');
    rerender(<SeatRow number={1} name="Nakul Dhillon" density="compact" onSelect={vi.fn()} />);
    expect(screen.getByRole('button')).toHaveClass('min-h-touch', 'tablet:min-h-row-compact');
  });

  it('is reached with Tab and pressed with Enter', async () => {
    const onSelect = vi.fn();
    renderIn(<SeatRow number={1} name="Nakul Dhillon" onSelect={onSelect} />);
    await userEvent.tab();
    await userEvent.keyboard('{Enter}');
    expect(onSelect).toHaveBeenCalledOnce();
  });

  it('has no accessibility violations', async () => {
    const { container } = renderIn(<SeatRow number={2} name="Vidya Chadha" request="Top-up" onSelect={vi.fn()} />);
    expect(await axeViolations(container)).toEqual([]);
  });
});
