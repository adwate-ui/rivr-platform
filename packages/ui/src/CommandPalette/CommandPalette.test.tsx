import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { axeViolations, renderIn } from '../test/render.tsx';
import { CommandPalette, type PaletteGroup } from './CommandPalette.tsx';
import { SearchTrigger } from './SearchTrigger.tsx';

function groups(onSelect: () => void = vi.fn()): PaletteGroup[] {
  return [
    { id: 'members', label: 'Members', items: [{ id: 'm1', label: 'Ritika Bhalla', meta: 'Table 1, seat 3', onSelect }] },
    { id: 'actions', label: 'Actions', items: [{ id: 'a1', label: 'Seat a player', onSelect }] },
    { id: 'screens', label: 'Screens', items: [{ id: 's1', label: 'Waitlist', onSelect }] },
    { id: 'none', label: 'Nothing here', items: [] },
  ];
}

/** The palette as an app holds it: open state and query in the app, the results for the query from it. */
function Harness({ onSelect = vi.fn(), onQuery = vi.fn() }: { onSelect?: () => void; onQuery?: (query: string) => void }) {
  const [isOpen, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  return (
    <>
      <SearchTrigger onOpen={() => setOpen(true)} />
      <input aria-label="Note" />
      <CommandPalette isOpen={isOpen} onOpenChange={setOpen} query={query}
        onQueryChange={(next) => { onQuery(next); setQuery(next); }} groups={query === 'zz' ? [] : groups(onSelect)} />
    </>
  );
}

const openWithKeys = () => userEvent.keyboard('{Control>}k{/Control}');

describe('CommandPalette', () => {
  it('opens from the header\'s search, its field focused, the results in their named groups', async () => {
    renderIn(<Harness />);
    await userEvent.click(screen.getByRole('button', { name: 'Search members, screens, actions' }));
    expect(screen.getByRole('dialog', { name: 'Search' })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Search' })).toHaveFocus();
    for (const group of ['Members', 'Actions', 'Screens']) expect(screen.getByRole('group', { name: group })).toBeInTheDocument();
    expect(screen.queryByRole('group', { name: 'Nothing here' })).toBeNull();
  });

  it('opens with Ctrl+K anywhere, and with / outside a field only', async () => {
    renderIn(<Harness />);
    await userEvent.click(screen.getByRole('textbox', { name: 'Note' }));
    await userEvent.keyboard('/');
    expect(screen.queryByRole('dialog')).toBeNull();
    await openWithKeys();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();
    screen.getByRole('textbox', { name: 'Note' }).blur();
    await userEvent.keyboard('/');
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('hands what is typed to the app, moves with the arrow keys and chooses with Enter, then closes', async () => {
    const onSelect = vi.fn();
    const onQuery = vi.fn();
    renderIn(<Harness onSelect={onSelect} onQuery={onQuery} />);
    await openWithKeys();
    await userEvent.keyboard('ri');
    expect(onQuery).toHaveBeenLastCalledWith('ri');
    expect(screen.getByRole('option', { name: /Ritika Bhalla/ })).toHaveAttribute('aria-selected', 'true');
    await userEvent.keyboard('{ArrowDown}');
    const seat = screen.getByRole('option', { name: /Seat a player/ });
    expect(seat).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('combobox')).toHaveAttribute('aria-activedescendant', seat.id);
    await userEvent.keyboard('{ArrowUp}{ArrowUp}');
    expect(screen.getByRole('option', { name: /Waitlist/ })).toHaveAttribute('aria-selected', 'true');
    await userEvent.keyboard('{Enter}');
    expect(onSelect).toHaveBeenCalledOnce();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('chooses a result with a click', async () => {
    const onSelect = vi.fn();
    renderIn(<Harness onSelect={onSelect} />);
    await openWithKeys();
    await userEvent.click(screen.getByRole('option', { name: /Seat a player/ }));
    expect(onSelect).toHaveBeenCalledOnce();
  });

  it('says when nothing matches, while it looks, and when it could not', async () => {
    const { rerender } = renderIn(<Harness />);
    await openWithKeys();
    await userEvent.keyboard('zz');
    expect(screen.getByRole('status')).toHaveTextContent('Nothing matches zz.');
    rerender(<CommandPalette isOpen onOpenChange={vi.fn()} query="ri" onQueryChange={vi.fn()} groups={[]} status="loading" />);
    expect(screen.getByRole('status')).toHaveTextContent('Loading');
    rerender(<CommandPalette isOpen onOpenChange={vi.fn()} query="ri" onQueryChange={vi.fn()} groups={[]} status="error" />);
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('has no accessibility violations', async () => {
    renderIn(<CommandPalette isOpen onOpenChange={vi.fn()} query="ri" onQueryChange={vi.fn()} groups={groups()} />);
    expect(await axeViolations(document.body)).toEqual([]);
  });
});
