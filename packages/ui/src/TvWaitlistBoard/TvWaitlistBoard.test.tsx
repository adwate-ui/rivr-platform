import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { axeViolations, renderIn } from '../test/render.tsx';
import { TvWaitlistBoard } from './TvWaitlistBoard.tsx';

const STAKES = [
  { id: 'a', stake: '₹50/100', detail: '1 table open', places: [] },
  {
    id: 'b', stake: '₹100/200', detail: '2 tables open',
    places: Array.from({ length: 7 }, (_, index) => ({ id: String(index), place: String(index + 1), name: `Player ${index + 1}`, status: index === 0 ? 'Table 3' : undefined })),
  },
];

describe('TvWaitlistBoard', () => {
  it('shows each stake with its places in order, the first six, and says when nobody waits', () => {
    renderIn(<TvWaitlistBoard title="Waitlist" stakes={STAKES} emptyText="No one waiting." />);
    expect(screen.getByRole('heading', { level: 1, name: 'Waitlist' })).toBeInTheDocument();
    expect(within(screen.getByRole('region', { name: '₹50/100' })).getByText('No one waiting.')).toBeInTheDocument();
    const busy = within(screen.getByRole('region', { name: '₹100/200' }));
    expect(busy.getAllByRole('listitem')).toHaveLength(6);
    expect(busy.getByText('Player 1')).toBeInTheDocument();
    expect(busy.getByText('Table 3')).toBeInTheDocument();
    expect(busy.queryByText('Player 7')).toBeNull();
  });

  it('has no accessibility violations', async () => {
    const { container } = renderIn(<TvWaitlistBoard title="Waitlist" stakes={STAKES} emptyText="No one waiting." />);
    expect(await axeViolations(container)).toEqual([]);
  });
});
