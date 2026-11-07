import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { axeViolations, renderIn } from '../test/render.tsx';
import { TableListRow } from './TableListRow.tsx';

describe('TableListRow', () => {
  it('opens the table from anywhere on the row, with the wait in gold when no one waits and the line under the name', async () => {
    const onOpen = vi.fn();
    renderIn(<TableListRow name="Table 1 · NLH 50/100" detail="Min buy-in ₹5,000" wait="No wait" isNoWait onOpen={onOpen} />);
    const row = screen.getByRole('button', { name: /Table 1 · NLH 50\/100/ });
    expect(row).toHaveTextContent('Min buy-in ₹5,000');
    expect(screen.getByText('No wait')).toHaveClass('text-accent');
    await userEvent.click(row);
    expect(onOpen).toHaveBeenCalledOnce();
  });

  it('shows no seats, open or taken, and with no wait given nothing at the right: players see neither', () => {
    const { container } = renderIn(<TableListRow name="Table 1 · NLH 100/200/400" detail="Min buy-in ₹10,000" onOpen={() => undefined} />);
    expect(container.querySelectorAll('.size-pip')).toHaveLength(0);
    expect(screen.getByRole('button')).toHaveTextContent(/^Table 1 · NLH 100\/200\/400Min buy-in ₹10,000$/);
  });

  it('is dimmed and cannot be pressed while closed, with its line under the wait', () => {
    renderIn(<TableListRow name="Table 4" wait="Closed" seatsLine="Opens later" isClosed onOpen={() => undefined} />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.getByText('Opens later')).toBeInTheDocument();
    expect(screen.getByText('Table 4').closest('div')).toHaveClass('opacity-disabled');
  });

  it('has no accessibility violations', async () => {
    const { container } = renderIn(<TableListRow name="Table 1" detail="Min buy-in ₹5,000" wait="1 waiting" onOpen={() => undefined} />);
    expect(await axeViolations(container)).toEqual([]);
  });
});
