import { act, fireEvent, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { Button } from '../Button/Button.tsx';
import { renderIn } from '../test/render.tsx';
import { ShortcutProvider, useShortcut, useShortcutList } from './Shortcuts.tsx';

function SeatButton({ onSeat, isEnabled = true }: { onSeat: () => void; isEnabled?: boolean }) {
  const shortcut = useShortcut({ key: 's', label: 'Seat a player', onPress: onSeat, isEnabled });
  return <Button variant="primary" shortcut={shortcut} onClick={onSeat}>Seat a player</Button>;
}

function List() {
  const shortcuts = useShortcutList();
  return <p data-testid="list">{shortcuts.map((one) => `${one.keys} ${one.label}`).join(', ')}</p>;
}

function Screen({ onSeat, onApprove }: { onSeat: () => void; onApprove: () => void }) {
  useShortcut({ key: 'a', label: 'Approve the oldest request', onPress: onApprove });
  return <SeatButton onSeat={onSeat} />;
}

function press(key: string, init: KeyboardEventInit = {}, target: Element | Window = window) {
  fireEvent.keyDown(target, { key, ...init });
}

describe('keyboard shortcuts', () => {
  it('does the job of a key the screen offers, in either case, and names it on its button', () => {
    const onSeat = vi.fn();
    renderIn(<ShortcutProvider><SeatButton onSeat={onSeat} /></ShortcutProvider>);
    press('s');
    press('S');
    expect(onSeat).toHaveBeenCalledTimes(2);
    const button = screen.getByRole('button', { name: 'Seat a player' });
    expect(button).toHaveAttribute('title', 'Seat a player (S)');
    expect(button).toHaveAttribute('aria-keyshortcuts', 'S');
  });

  it('ignores keys while the staff member types in a field, holds a modifier, or works in a sheet', () => {
    const onSeat = vi.fn();
    renderIn(
      <ShortcutProvider>
        <SeatButton onSeat={onSeat} />
        <input aria-label="Mobile number" />
        <div role="dialog" aria-label="Seat sheet"><button type="button">Seat 4</button></div>
      </ShortcutProvider>,
    );
    press('s', {}, screen.getByRole('textbox', { name: 'Mobile number' }));
    press('s', { ctrlKey: true });
    press('s', { metaKey: true });
    press('s', {}, screen.getByRole('button', { name: 'Seat 4' }));
    press('s', { repeat: true });
    expect(onSeat).not.toHaveBeenCalled();
  });

  it('lists the keys offered by key, and drops a key once its screen is gone or it is disabled', () => {
    function Toggle() {
      const [isOpen, setOpen] = useState(true);
      return (
        <ShortcutProvider>
          {isOpen ? <Screen onSeat={vi.fn()} onApprove={vi.fn()} /> : <SeatButton onSeat={vi.fn()} isEnabled={false} />}
          <button type="button" onClick={() => setOpen(false)}>Leave</button>
          <List />
        </ShortcutProvider>
      );
    }
    renderIn(<Toggle />);
    expect(screen.getByTestId('list')).toHaveTextContent('A Approve the oldest request, S Seat a player');
    act(() => screen.getByRole('button', { name: 'Leave' }).click());
    expect(screen.getByTestId('list')).toHaveTextContent(/^$/);
  });

  it('leaves a key no screen offers to the page', () => {
    renderIn(<ShortcutProvider><SeatButton onSeat={vi.fn()} /></ShortcutProvider>);
    const event = new KeyboardEvent('keydown', { key: 'x', cancelable: true });
    window.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(false);
  });

  it('still names the key on a button outside a provider, and offers nothing', () => {
    renderIn(<SeatButton onSeat={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Seat a player' })).toHaveAttribute('title', 'Seat a player (S)');
  });

  it('turns every single-key shortcut off when the staff member switches them off (WCAG 2.1.4)', () => {
    const onSeat = vi.fn();
    const onApprove = vi.fn();
    renderIn(<ShortcutProvider isOn={false}><Screen onSeat={onSeat} onApprove={onApprove} /><List /></ShortcutProvider>);
    const event = new KeyboardEvent('keydown', { key: 's', cancelable: true });
    window.dispatchEvent(event);
    press('a');
    expect(onSeat).not.toHaveBeenCalled();
    expect(onApprove).not.toHaveBeenCalled();
    expect(event.defaultPrevented).toBe(false);
    expect(screen.getByTestId('list')).toHaveTextContent('');
    const button = screen.getByRole('button', { name: 'Seat a player' });
    expect(button).not.toHaveAttribute('title');
    expect(button).not.toHaveAttribute('aria-keyshortcuts');
  });
});
