import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { axeViolations, renderIn } from '../test/render.tsx';
import { SplitView } from './SplitView.tsx';

/** A list of one member that opens her record, and closes it from the way back. */
function Members() {
  const [isOpen, setOpen] = useState(false);
  return (
    <SplitView list={<button type="button" onClick={() => setOpen(true)}>Arjun Mehta</button>}
      detail={isOpen ? <p>Arjun Mehta, Black card</p> : null} backLabel="Back to Members" onBack={() => setOpen(false)} emptyText="Choose a member." />
  );
}

describe('SplitView', () => {
  it('shows the list and, with no record open, what to do', () => {
    renderIn(<SplitView list={<p>Members list</p>} detail={null} backLabel="Back to Members" onBack={vi.fn()} emptyText="Choose a member." />);
    expect(screen.getByText('Members list')).toBeInTheDocument();
    expect(screen.getByText('Choose a member.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Back to Members' })).not.toBeInTheDocument();
  });

  it('shows the record with a way back to the list, which a phone hides while the record shows', async () => {
    const onBack = vi.fn();
    renderIn(<SplitView list={<p>Members list</p>} detail={<p>Arjun Mehta</p>} backLabel="Back to Members" onBack={onBack} emptyText="Choose a member." />);
    expect(screen.getByText('Arjun Mehta')).toBeInTheDocument();
    expect(screen.getByText('Members list').parentElement).toHaveClass('hidden', 'tablet:block');
    await userEvent.click(screen.getByRole('button', { name: 'Back to Members' }));
    expect(onBack).toHaveBeenCalled();
  });

  it('moves focus to the record as it opens, and back to the row that opened it as it closes', async () => {
    renderIn(<Members />);
    await userEvent.click(screen.getByRole('button', { name: 'Arjun Mehta' }));
    expect(screen.getByText('Arjun Mehta, Black card').parentElement).toHaveFocus();
    await userEvent.click(screen.getByRole('button', { name: 'Back to Members' }));
    expect(screen.getByRole('button', { name: 'Arjun Mehta' })).toHaveFocus();
  });

  it('keeps the list on a phone while the record shown was not chosen, and shows both from 1180 px', () => {
    renderIn(<SplitView list={<p>Tables</p>} detail={<p>Table 1</p>} isChosen={false} backLabel="Back to the floor" onBack={vi.fn()} emptyText="Choose a table." />);
    expect(screen.getByText('Tables').parentElement).not.toHaveClass('hidden');
    expect(screen.getByText('Table 1').parentElement?.parentElement).toHaveClass('hidden', 'tablet:flex');
  });

  it('leaves focus where it is from 1180 px, where the list stays beside the record', async () => {
    vi.stubGlobal('matchMedia', (media: string) => ({ matches: true, media, addEventListener: () => undefined, removeEventListener: () => undefined }));
    try {
      renderIn(<Members />);
      await userEvent.click(screen.getByRole('button', { name: 'Arjun Mehta' }));
      expect(screen.getByRole('button', { name: 'Arjun Mehta' })).toHaveFocus();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('has no accessibility violations', async () => {
    const { container } = renderIn(<SplitView list={<p>List</p>} detail={<p>Record</p>} backLabel="Back" onBack={vi.fn()} emptyText="Choose." />);
    expect(await axeViolations(container)).toEqual([]);
  });
});
