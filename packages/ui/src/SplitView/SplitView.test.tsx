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
      detail={isOpen ? <p>Arjun Mehta, Black card</p> : null} backLabel="Back to Members" onBack={() => setOpen(false)} onClose={() => setOpen(false)} />
  );
}

describe('SplitView', () => {
  it('shows the list alone, across the width, with no record open, and two fifths of it once one opens (C-03)', () => {
    const { rerender } = renderIn(<SplitView list={<p>Members list</p>} detail={null} backLabel="Back to Members" onBack={vi.fn()} />);
    expect(screen.getByText('Members list').parentElement?.className).toContain('tablet:col-span-5');
    expect(screen.queryByRole('button', { name: 'Back to Members' })).not.toBeInTheDocument();
    rerender(<SplitView list={<p>Members list</p>} detail={<p>Arjun Mehta</p>} backLabel="Back to Members" onBack={vi.fn()} />);
    expect(screen.getByText('Members list').parentElement?.className).toContain('tablet:col-span-2');
  });

  it('shows the record with a way back to the list, which a phone hides while the record shows', async () => {
    const onBack = vi.fn();
    renderIn(<SplitView list={<p>Members list</p>} detail={<p>Arjun Mehta</p>} backLabel="Back to Members" onBack={onBack} />);
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
    renderIn(<SplitView list={<p>Tables</p>} detail={<p>Table 1</p>} isChosen={false} backLabel="Back to the floor" onBack={vi.fn()} />);
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

  it('closes a chosen record with Close or Escape from 1180 px, giving the list its width and the row its focus back (the owner, 17 Nov)', async () => {
    vi.stubGlobal('matchMedia', (media: string) => ({ matches: true, media, addEventListener: () => undefined, removeEventListener: () => undefined }));
    try {
      renderIn(<Members />);
      const row = screen.getByRole('button', { name: 'Arjun Mehta' });
      await userEvent.click(row);
      await userEvent.click(screen.getByRole('button', { name: 'Close' }));
      expect(screen.queryByText('Arjun Mehta, Black card')).not.toBeInTheDocument();
      expect(row.parentElement).toHaveClass('tablet:col-span-5');
      expect(row).toHaveFocus();

      await userEvent.click(row);
      await userEvent.keyboard('{Escape}');
      expect(screen.queryByText('Arjun Mehta, Black card')).not.toBeInTheDocument();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('leaves Escape to a field being typed in or an open dialog, and offers no Close on a record shown but not chosen', async () => {
    const onBack = vi.fn();
    const { rerender } = renderIn(<SplitView list={<p>Members</p>} detail={<input aria-label="Note" />} backLabel="Back" onBack={onBack} onClose={onBack} />);
    await userEvent.type(screen.getByRole('textbox', { name: 'Note' }), '{Escape}');
    rerender(<SplitView list={<p>Members</p>} detail={<div role="dialog" aria-label="Give Bonus">Give Bonus</div>} backLabel="Back" onBack={onBack} onClose={onBack} />);
    await userEvent.keyboard('{Escape}');
    expect(onBack).not.toHaveBeenCalled();
    rerender(<SplitView list={<p>Tables</p>} detail={<p>Table 1</p>} isChosen={false} backLabel="Back" onBack={onBack} onClose={onBack} />);
    expect(screen.queryByRole('button', { name: 'Close' })).not.toBeInTheDocument();
    await userEvent.keyboard('{Escape}');
    expect(onBack).not.toHaveBeenCalled();
  });

  it('offers neither Close nor Escape where the screen gives no onClose, as KYC review and Content', async () => {
    const onBack = vi.fn();
    renderIn(<SplitView layout="even" list={<p>Checks</p>} detail={<p>Rohan</p>} backLabel="Back" onBack={onBack} />);
    expect(screen.queryByRole('button', { name: 'Close' })).not.toBeInTheDocument();
    await userEvent.keyboard('{Escape}');
    expect(onBack).not.toHaveBeenCalled();
  });

  it('splits the width evenly with layout even, and docks the record in a side panel with layout docked', () => {
    const { unmount } = renderIn(<SplitView layout="even" list={<p>Checks</p>} detail={<p>Rohan</p>} backLabel="Back" onBack={vi.fn()} />);
    expect(screen.getByText('Checks').parentElement?.parentElement).toHaveClass('tablet:grid-cols-2');
    unmount();
    renderIn(<SplitView layout="docked" list={<p>Members</p>} detail={<p>Sakshi</p>} backLabel="Back" onBack={vi.fn()} />);
    expect(screen.getByText('Members').parentElement).toHaveClass('tablet:flex-1');
    expect(screen.getByText('Sakshi').parentElement?.parentElement).toHaveClass('tablet:w-side-panel', 'tablet:shrink-0');
  });

  it('keeps the docked record in view as a long list scrolls, a record taller than the screen scrolling on its own (the owner, 15 Nov night)', () => {
    renderIn(<SplitView layout="docked" list={<p>Members</p>} detail={<p>Sakshi</p>} backLabel="Back" onBack={vi.fn()} />);
    expect(screen.getByText('Sakshi').parentElement?.parentElement).toHaveClass('tablet:sticky', 'tablet:top-0', 'tablet:max-h-console-view', 'tablet:overflow-y-auto');
  });

  it('starts a different record at its top, not where the last one was scrolled to, and keeps the place of the same one', () => {
    const docked = (recordKey: string, name: string) => (
      <SplitView layout="docked" recordKey={recordKey} list={<p>Members</p>} detail={<p>{name}</p>} backLabel="Back" onBack={vi.fn()} />
    );
    const { rerender } = renderIn(docked('m1', 'Sakshi'));
    const panel = screen.getByText('Sakshi').parentElement?.parentElement;
    if (!panel) throw new Error('no record panel');
    Object.defineProperty(panel, 'scrollTop', { configurable: true, writable: true, value: 640 });
    rerender(docked('m1', 'Sakshi, edited'));
    expect(panel.scrollTop).toBe(640);
    rerender(docked('m2', 'Rohan'));
    expect(panel.scrollTop).toBe(0);
  });

  it('has no accessibility violations', async () => {
    const { container } = renderIn(<SplitView list={<p>List</p>} detail={<p>Record</p>} backLabel="Back" onBack={vi.fn()} />);
    expect(await axeViolations(container)).toEqual([]);
  });
});
