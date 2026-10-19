import { fireEvent, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { renderIn } from '../test/render.tsx';
import { TableCard } from './TableCard.tsx';

const SEATS = [{ number: 1, initials: 'VR' }, { number: 2, initials: null }];

describe('TableCard', () => {
  it('shows the ring, occupancy, rake, dealer and pace, and is pressed to open the table', () => {
    const onSelect = vi.fn();
    renderIn(<TableCard name="Table 3" stakes="100/200" seats={SEATS} ringLabel="Table 3, 1 of 2 seats taken" occupancy="1 of 2"
      rake={9_630_000n} dealer="Pema Lepcha" pace="30 hands/hr" onSelect={onSelect} />);
    const card = screen.getByRole('button', { name: 'Table 3' });
    expect(card).toHaveAttribute('aria-pressed', 'false');
    expect(card).toHaveAccessibleDescription(/^Table 3, 1 of 2 seats taken.*₹96,300.*Pema Lepcha.*30 hands\/hr$/);
    expect(card.querySelector('div, p')).toBeNull();
    expect(screen.getByText('₹96,300')).toBeInTheDocument();
    expect(screen.getByText('Pema Lepcha')).toBeInTheDocument();
    expect(screen.getByText('30 hands/hr')).toBeInTheDocument();
    fireEvent.click(card);
    expect(onSelect).toHaveBeenCalledOnce();
  });

  it('shows no rake for staff who do not read the ledger, and marks the table open beside', () => {
    renderIn(<TableCard name="Table 3" stakes="100/200" seats={SEATS} ringLabel="Table 3" occupancy="1 of 2" rake={null}
      dealer="No dealer" pace="-" isSelected onSelect={() => undefined} />);
    expect(screen.queryByText(/₹/)).toBeNull();
    expect(screen.getByRole('button', { name: 'Table 3' })).toHaveAttribute('aria-pressed', 'true');
  });
});
