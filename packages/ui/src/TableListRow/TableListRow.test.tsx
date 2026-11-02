import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { axeViolations, renderIn } from '../test/render.tsx';
import { TableListRow } from './TableListRow.tsx';

describe('TableListRow', () => {
  it('opens the table from anywhere on the row, with the wait in gold when no one waits', async () => {
    const onOpen = vi.fn();
    renderIn(<TableListRow name="Table 1 · NLH 50/100" openSeats={3} wait="No wait" isNoWait seatsLine="3 open" onOpen={onOpen} />);
    const row = screen.getByRole('button', { name: /Table 1 · NLH 50\/100/ });
    expect(row).toHaveTextContent('3 open');
    expect(screen.getByText('No wait')).toHaveClass('text-accent');
    await userEvent.click(row);
    expect(onOpen).toHaveBeenCalledOnce();
  });

  it('draws a dot a seat, the open ones gold and last', () => {
    const { container } = renderIn(<TableListRow name="Table 1" openSeats={2} wait="No wait" seatsLine="2 open" onOpen={() => undefined} />);
    const dots = [...container.querySelectorAll('.size-pip')];
    expect(dots).toHaveLength(9);
    expect(dots.filter((dot) => dot.classList.contains('bg-gold'))).toHaveLength(2);
    expect(dots.at(-1)).toHaveClass('bg-gold');
  });

  it('is dimmed and cannot be pressed while closed', () => {
    renderIn(<TableListRow name="Table 4" openSeats={0} wait="Closed" seatsLine="Opens later" isClosed onOpen={() => undefined} />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.getByText('Table 4').closest('div')).toHaveClass('opacity-disabled');
  });

  it('has no accessibility violations', async () => {
    const { container } = renderIn(<TableListRow name="Table 1" openSeats={1} wait="1 waiting" seatsLine="1 open" onOpen={() => undefined} />);
    expect(await axeViolations(container)).toEqual([]);
  });
});
