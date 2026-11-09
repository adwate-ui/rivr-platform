import { useEffect, useId, useRef, useState, type FocusEvent, type KeyboardEvent, type RefObject } from 'react';
import { Icon } from '../Icon/Icon.tsx';
import { cx } from '../internal/classes.ts';

export interface OverflowMenuItem {
  readonly id: string;
  /** Already translated, a verb first: "Hold place", "Remove from list". */
  readonly label: string;
  readonly onSelect: () => void;
  /** `danger`, a step that removes or ends something: its words in the console's danger red. */
  readonly tone?: 'danger' | undefined;
  /** Dimmed and never chosen, but still reached by the arrow keys, so the menu reads the same each time. */
  readonly isDisabled?: boolean | undefined;
}

export interface OverflowMenuProps {
  /** Names the ⋯ button and its menu for what they act on: "More for Table 3". */
  label: string;
  items: readonly OverflowMenuItem[];
  /** The edge of the button the menu lines up with: `end`, the default, for a button at a row's end. */
  align?: 'start' | 'end';
  /** Words on the button in place of ⋯, as a table's "Export" (console v3); `label` still names it in full: "Export Members". */
  text?: string;
}

const TRIGGER =
  'inline-flex size-touch shrink-0 items-center justify-center rounded-md text-content-muted transition-colors tablet:size-8 ' +
  'hover:bg-subtle-hover hover:text-content aria-expanded:bg-subtle-hover aria-expanded:text-content ' +
  'focus-visible:outline-2 focus-visible:outline-focus';

// The prototype's quiet word-button at a screen's top right: muted words that brighten on hover, as the ⋯ does.
const TEXT_TRIGGER =
  'inline-flex min-h-touch shrink-0 items-center justify-center rounded-md px-3 font-text text-13 leading-control font-medium text-content-muted ' +
  'transition-colors tablet:min-h-8 hover:bg-subtle-hover hover:text-content aria-expanded:bg-subtle-hover aria-expanded:text-content ' +
  'focus-visible:outline-2 focus-visible:outline-focus';

const MENU = 'absolute top-full z-overlay mt-1 flex min-w-32 flex-col rounded-lg bg-raised p-1 shadow-modal focus:outline-none';

// Danger words on the raised menu are 5.86:1, and 5.14:1 on an item's hover fill.
const ITEM =
  'flex min-h-touch w-full items-center rounded-md px-3 py-2 text-start font-text text-13 leading-control whitespace-nowrap transition-colors tablet:min-h-control ' +
  'hover:bg-subtle focus-visible:bg-subtle focus-visible:outline-2 focus-visible:outline-focus ' +
  'aria-disabled:cursor-not-allowed aria-disabled:opacity-disabled';

/** The item an arrow key, Home or End moves to from `index` (-1 for none), wrapping round; null for any other key. */
function moveTo(key: string, index: number, count: number): number | null {
  if (key === 'ArrowDown') return (index + 1) % count;
  if (key === 'ArrowUp') return (Math.max(index, 0) - 1 + count) % count;
  if (key === 'Home') return 0;
  if (key === 'End') return count - 1;
  return null;
}

interface MenuRefs {
  readonly trigger: RefObject<HTMLButtonElement | null>;
  readonly entries: RefObject<(HTMLButtonElement | null)[]>;
}

/** Whether the menu is open, and the handlers that open, move through and close it. */
function useMenu(items: readonly OverflowMenuItem[], { trigger, entries }: MenuRefs) {
  const [isOpen, setOpen] = useState(false);
  useEffect(() => {
    if (isOpen) entries.current[0]?.focus();
  }, [isOpen, entries]);
  const closeToTrigger = () => {
    setOpen(false);
    trigger.current?.focus();
  };
  const select = (item: OverflowMenuItem) => {
    if (item.isDisabled) return;
    closeToTrigger();
    item.onSelect();
  };
  const onTriggerKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key !== 'ArrowDown') return;
    event.preventDefault();
    setOpen(true);
  };
  const onMenuKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape' || (event.key === 'Tab' && event.shiftKey)) {
      event.preventDefault();
      closeToTrigger();
      return;
    }
    const next = moveTo(event.key, entries.current.findIndex((entry) => entry === document.activeElement), items.length);
    if (next === null) return;
    event.preventDefault();
    entries.current[next]?.focus();
  };
  // Tab past the last item, or a click anywhere else, takes the focus out: the menu closes and the focus goes on.
  const onBlur = (event: FocusEvent<HTMLDivElement>) => {
    if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
  };
  return { isOpen, toggle: () => setOpen((open) => !open), select, onTriggerKeyDown, onMenuKeyDown, onBlur };
}

/**
 * A row's or a tile's further actions behind a ⋯ button, or a few words such as a table's Export (console v3): a menu below it on a raised panel, opened by a
 * press, Enter, Space or the down arrow with the focus on its first item. The arrow keys move through it, Enter or Space
 * chooses, Escape closes it back to the button, and Tab or a click elsewhere closes it.
 */
export function OverflowMenu({ label, items, align = 'end', text }: OverflowMenuProps) {
  const trigger = useRef<HTMLButtonElement>(null);
  const entries = useRef<(HTMLButtonElement | null)[]>([]);
  const menu = useMenu(items, { trigger, entries });
  const buttonId = useId();
  const menuId = useId();
  return (
    <div className="relative inline-flex" onBlur={menu.onBlur}>
      <button ref={trigger} id={buttonId} type="button" aria-label={label} aria-haspopup="menu" aria-expanded={menu.isOpen}
        aria-controls={menu.isOpen ? menuId : undefined} onClick={menu.toggle} onKeyDown={menu.onTriggerKeyDown} className={text === undefined ? TRIGGER : TEXT_TRIGGER}>
        {text === undefined ? <Icon name="overflow" /> : text}
      </button>
      {menu.isOpen ? (
        <div id={menuId} role="menu" aria-labelledby={buttonId} tabIndex={-1} onKeyDown={menu.onMenuKeyDown}
          className={cx(MENU, align === 'end' ? 'end-0' : 'start-0')}>
          {items.map((item, index) => (
            <button key={item.id} ref={(element) => { entries.current[index] = element; }} type="button" role="menuitem" tabIndex={-1}
              aria-disabled={item.isDisabled ? true : undefined} onClick={() => menu.select(item)}
              className={cx(ITEM, item.tone === 'danger' ? 'text-danger' : 'text-content')}>
              {item.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
