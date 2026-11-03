import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { axeViolations, renderIn } from '../test/render.tsx';
import { OverflowMenu, type OverflowMenuItem } from './OverflowMenu.tsx';

function itemsWith(onHold = vi.fn(), onRemove = vi.fn()): OverflowMenuItem[] {
  return [
    { id: 'hold', label: 'Hold place', onSelect: onHold },
    { id: 'move', label: 'Move to Table 2', onSelect: vi.fn(), isDisabled: true },
    { id: 'remove', label: 'Remove from list', onSelect: onRemove, tone: 'danger' },
  ];
}

const trigger = () => screen.getByRole('button', { name: 'More for Ritika Bhalla' });

describe('OverflowMenu', () => {
  it('is a button named for what it acts on, saying it opens a menu, closed at first', () => {
    renderIn(<OverflowMenu label="More for Ritika Bhalla" items={itemsWith()} />);
    expect(trigger()).toHaveAttribute('aria-haspopup', 'menu');
    expect(trigger()).toHaveAttribute('aria-expanded', 'false');
    expect(trigger()).toHaveClass('size-touch', 'tablet:size-8');
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('opens its menu when pressed, named by the button, with the focus on the first item', async () => {
    renderIn(<OverflowMenu label="More for Ritika Bhalla" items={itemsWith()} />);
    await userEvent.click(trigger());
    expect(trigger()).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('menu', { name: 'More for Ritika Bhalla' })).toBeInTheDocument();
    expect(screen.getAllByRole('menuitem').map((item) => item.textContent)).toEqual(['Hold place', 'Move to Table 2', 'Remove from list']);
    expect(screen.getByRole('menuitem', { name: 'Hold place' })).toHaveFocus();
  });

  it.each(['{Enter}', ' ', '{ArrowDown}'])('opens from the keyboard with %s and focuses the first item', async (key) => {
    renderIn(<OverflowMenu label="More for Ritika Bhalla" items={itemsWith()} />);
    await userEvent.tab();
    await userEvent.keyboard(key);
    expect(screen.getByRole('menuitem', { name: 'Hold place' })).toHaveFocus();
  });

  it('moves through the items with the arrow keys, wrapping, and to either end with Home and End', async () => {
    renderIn(<OverflowMenu label="More for Ritika Bhalla" items={itemsWith()} />);
    await userEvent.click(trigger());
    await userEvent.keyboard('{ArrowDown}');
    expect(screen.getByRole('menuitem', { name: 'Move to Table 2' })).toHaveFocus();
    await userEvent.keyboard('{ArrowDown}{ArrowDown}');
    expect(screen.getByRole('menuitem', { name: 'Hold place' })).toHaveFocus();
    await userEvent.keyboard('{ArrowUp}');
    expect(screen.getByRole('menuitem', { name: 'Remove from list' })).toHaveFocus();
    await userEvent.keyboard('{Home}');
    expect(screen.getByRole('menuitem', { name: 'Hold place' })).toHaveFocus();
    await userEvent.keyboard('{End}');
    expect(screen.getByRole('menuitem', { name: 'Remove from list' })).toHaveFocus();
  });

  it.each(['{Enter}', ' '])('chooses an item with %s, closes, and gives the focus back to the button', async (key) => {
    const onRemove = vi.fn();
    renderIn(<OverflowMenu label="More for Ritika Bhalla" items={itemsWith(vi.fn(), onRemove)} />);
    await userEvent.click(trigger());
    await userEvent.keyboard('{End}');
    await userEvent.keyboard(key);
    expect(onRemove).toHaveBeenCalledOnce();
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(trigger()).toHaveFocus();
  });

  it('chooses an item when clicked', async () => {
    const onHold = vi.fn();
    renderIn(<OverflowMenu label="More for Ritika Bhalla" items={itemsWith(onHold)} />);
    await userEvent.click(trigger());
    await userEvent.click(screen.getByRole('menuitem', { name: 'Hold place' }));
    expect(onHold).toHaveBeenCalledOnce();
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('closes with Escape and gives the focus back to the button', async () => {
    renderIn(<OverflowMenu label="More for Ritika Bhalla" items={itemsWith()} />);
    await userEvent.click(trigger());
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(trigger()).toHaveFocus();
  });

  it('closes when Tab or Shift Tab leaves it', async () => {
    renderIn(<><OverflowMenu label="More for Ritika Bhalla" items={itemsWith()} /><button type="button">Next</button></>);
    await userEvent.click(trigger());
    await userEvent.tab();
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Next' })).toHaveFocus();
    await userEvent.click(trigger());
    await userEvent.tab({ shift: true });
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(trigger()).toHaveFocus();
  });

  it('closes on a click outside it, and when its button is pressed again', async () => {
    renderIn(<><OverflowMenu label="More for Ritika Bhalla" items={itemsWith()} /><p>Elsewhere</p></>);
    await userEvent.click(trigger());
    await userEvent.click(screen.getByText('Elsewhere'));
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    await userEvent.click(trigger());
    await userEvent.click(trigger());
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('keeps a disabled item reachable but never chooses it', async () => {
    const items = itemsWith();
    renderIn(<OverflowMenu label="More for Ritika Bhalla" items={items} />);
    await userEvent.click(trigger());
    const move = screen.getByRole('menuitem', { name: 'Move to Table 2' });
    expect(move).toHaveAttribute('aria-disabled', 'true');
    await userEvent.click(move);
    expect(items[1]?.onSelect).not.toHaveBeenCalled();
    expect(screen.getByRole('menu')).toBeInTheDocument();
  });

  it('writes a danger item in the danger colour on the raised menu', async () => {
    renderIn(<OverflowMenu label="More for Ritika Bhalla" items={itemsWith()} />);
    await userEvent.click(trigger());
    expect(screen.getByRole('menu')).toHaveClass('bg-raised', 'rounded-lg', 'shadow-modal');
    expect(screen.getByRole('menuitem', { name: 'Remove from list' })).toHaveClass('text-danger');
    expect(screen.getByRole('menuitem', { name: 'Hold place' })).toHaveClass('text-content', 'text-13');
  });

  it('lines the menu up with the button\'s end, or its start when asked', async () => {
    const { rerender } = renderIn(<OverflowMenu label="More for Ritika Bhalla" items={itemsWith()} />);
    await userEvent.click(trigger());
    expect(screen.getByRole('menu')).toHaveClass('end-0');
    rerender(<OverflowMenu label="More for Ritika Bhalla" items={itemsWith()} align="start" />);
    expect(screen.getByRole('menu')).toHaveClass('start-0');
  });

  it('has no accessibility violations, closed or open', async () => {
    const { container } = renderIn(<OverflowMenu label="More for Ritika Bhalla" items={itemsWith()} />);
    expect(await axeViolations(container)).toEqual([]);
    await userEvent.click(trigger());
    expect(await axeViolations(container)).toEqual([]);
  });
});
