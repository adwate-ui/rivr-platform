import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Button } from '../Button/Button.tsx';
import { axeViolations, renderIn } from '../test/render.tsx';
import { TableTile, type TileSeat } from './TableTile.tsx';

const SEATS: TileSeat[] = ['seated', 'needsYou', 'open', 'seated', 'seated', 'open', 'seated', 'needsYou', 'open'];

function renderTile(props: Partial<Parameters<typeof TableTile>[0]> = {}) {
  const onToggle = vi.fn();
  const onSettings = vi.fn();
  const view = renderIn(
    <TableTile name="Table 1" stake="50/100" seats={SEATS} isExpanded={false} onToggle={onToggle} onSettings={onSettings} {...props}>
      <button type="button">Seat 1, Nakul Dhillon</button>
    </TableTile>,
  );
  return { ...view, onToggle, onSettings };
}

describe('TableTile', () => {
  it('names the table and its stake, says how many sit there and how many need the floor, and reads the bar in words', () => {
    renderTile();
    expect(screen.getByRole('group', { name: 'Table 1 50/100' })).toBeInTheDocument();
    expect(screen.getByText('6 of 9 seated')).toBeInTheDocument();
    expect(screen.getByText('2 need you')).toHaveClass('text-gold');
    expect(screen.getByRole('button', { name: 'Table 1 50/100', description: '4 seated, 2 need you, 3 open' })).toHaveAttribute('aria-expanded', 'false');
  });

  it('says "1 needs you" for one, and Show seats when nobody does', () => {
    const { rerender } = renderTile({ seats: ['needsYou', 'open'] });
    expect(screen.getByText('1 needs you')).toBeInTheDocument();
    rerender(<TableTile name="Table 1" stake="50/100" seats={['seated', 'open']} isExpanded={false} onToggle={vi.fn()} onSettings={vi.fn()} />);
    expect(screen.getByText('Show seats')).toBeInTheDocument();
  });

  it('rings a tile that needs the floor in gold, and no other (decision 0429)', () => {
    const { rerender } = renderTile();
    expect(screen.getByRole('group')).toHaveClass('inset-ring-gold-edge');
    rerender(<TableTile name="Table 1" stake="50/100" seats={['seated', 'open']} isExpanded={false} onToggle={vi.fn()} onSettings={vi.fn()} />);
    expect(screen.getByRole('group')).not.toHaveClass('inset-ring-gold-edge');
  });

  it('shows or hides its seats once from a press on the tile or from the keyboard, and ⋯ opens its settings alone', async () => {
    const { onToggle, onSettings } = renderTile();
    await userEvent.click(screen.getByText('Table 1'));
    expect(onToggle).toHaveBeenCalledTimes(1);
    screen.getByRole('button', { name: 'Table 1 50/100' }).focus();
    await userEvent.keyboard('{Enter}');
    expect(onToggle).toHaveBeenCalledTimes(2);
    await userEvent.click(screen.getByRole('button', { name: 'Settings for Table 1' }));
    expect(onSettings).toHaveBeenCalledOnce();
    expect(onToggle).toHaveBeenCalledTimes(2);
  });

  it('lists its seats while expanded', () => {
    renderTile({ isExpanded: true });
    expect(screen.getByRole('button', { name: 'Table 1 50/100' })).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('button', { name: 'Seat 1, Nakul Dhillon' })).toBeInTheDocument();
    expect(screen.getByText('6 of 9 seated').closest('button')).toHaveAttribute('aria-controls');
  });

  it('says a closed table is closed, with the action that opens it, and no seats', () => {
    renderTile({ isClosed: true, isExpanded: true, openAction: <Button variant="subtle" size="small">Open table</Button> });
    expect(screen.getByText('Closed')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Open table' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Seat 1, Nakul Dhillon' })).toBeNull();
    expect(screen.getByRole('group')).not.toHaveClass('inset-ring-gold-edge');
  });

  it('has no accessibility violations, closed or open', async () => {
    const { container, rerender } = renderTile({ isExpanded: true });
    expect(await axeViolations(container)).toEqual([]);
    rerender(<TableTile name="Table 4" stake="100/200" seats={SEATS} isClosed isExpanded={false} onToggle={vi.fn()} onSettings={vi.fn()} />);
    expect(await axeViolations(container)).toEqual([]);
  });
});
