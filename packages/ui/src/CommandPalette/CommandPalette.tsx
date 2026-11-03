import * as Dialog from '@radix-ui/react-dialog';
import { t } from '@rivr/i18n';
import { useEffect, useId, useState, type KeyboardEvent } from 'react';
import { cx } from '../internal/classes.ts';
import { Text } from '../Text/Text.tsx';

/** One result: what it says, a muted word at its right ("Table 2, seat 5", "Screen", "S"), and what choosing it does. */
export interface PaletteItem {
  readonly id: string;
  readonly label: string;
  readonly meta?: string | undefined;
  readonly onSelect: () => void;
}

/** A group of results: Members, Actions, Screens. A group with no items is left out. */
export interface PaletteGroup {
  readonly id: string;
  readonly label: string;
  readonly items: readonly PaletteItem[];
}

export interface CommandPaletteProps {
  isOpen: boolean;
  /** Opened by `/` (outside a field) or Ctrl or Cmd with K, closed by Escape, the scrim or a choice. */
  onOpenChange: (isOpen: boolean) => void;
  /** What is typed; the app finds the results for it. */
  query: string;
  onQueryChange: (query: string) => void;
  groups: readonly PaletteGroup[];
  /** `loading` while the app looks, `error` when it could not. */
  status?: 'ready' | 'loading' | 'error';
}

function isTyping(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName));
}

/** Ctrl or Cmd with K anywhere, or `/` outside a field, opens the palette. */
function useOpenShortcut(isOpen: boolean, onOpenChange: (isOpen: boolean) => void) {
  useEffect(() => {
    if (isOpen) return undefined;
    const onKey = (event: globalThis.KeyboardEvent) => {
      const isCommandK = (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k';
      const isSlash = event.key === '/' && !event.ctrlKey && !event.metaKey && !event.altKey && !isTyping(event.target);
      if (!isCommandK && !isSlash) return;
      event.preventDefault();
      onOpenChange(true);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onOpenChange]);
}

/** Arrow keys move through every result across the groups, wrapping; Enter chooses the one marked. */
function moveOrChoose(event: KeyboardEvent<HTMLInputElement>, count: number, active: number, act: { move: (index: number) => void; choose: () => void }) {
  if (count === 0) return;
  if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
    event.preventDefault();
    act.move((active + (event.key === 'ArrowDown' ? 1 : count - 1)) % count);
  } else if (event.key === 'Enter') {
    event.preventDefault();
    act.choose();
  }
}

/** What shows instead of results: faint rows while the app looks, why it could not, or that nothing matches. */
function Instead({ status, query }: { status: CommandPaletteProps['status']; query: string }) {
  if (status === 'loading') {
    return (
      <div role="status" className="flex flex-col gap-2 p-3">
        <span className="sr-only">{t('common.loading')}</span>
        {[0, 1, 2].map((row) => <span key={row} aria-hidden="true" className="h-6 rounded-md bg-skeleton-faint" />)}
      </div>
    );
  }
  if (status === 'error') return <div role="alert" className="px-3 py-4"><Text variant="small">{t('common.loadFailed')}</Text></div>;
  if (query.trim() === '') return null;
  return <div role="status" className="px-3 py-4"><Text variant="small" tone="muted">{t('ui.dataTable.noMatch', { query: query.trim() })}</Text></div>;
}

/**
 * The console's search (console v3): a field over the screen that finds members, actions and screens as the staff member
 * types, the results in their groups. Arrow keys move through them and Enter chooses; Escape closes. The app supplies the
 * results for what is typed through `onQueryChange` and `groups`; the palette holds which one is marked.
 */
export function CommandPalette(props: CommandPaletteProps) {
  useOpenShortcut(props.isOpen, props.onOpenChange);
  return (
    <Dialog.Root open={props.isOpen} onOpenChange={props.onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay data-scrim="" className="fixed inset-0 z-overlay bg-scrim" />
        {/* The field takes the focus as it opens, what was typed before selected, so typing replaces it. */}
        <Dialog.Content aria-describedby={undefined}
          className="fixed inset-x-3 top-3 z-modal mx-auto flex max-w-palette flex-col overflow-hidden rounded-lg bg-raised text-content shadow-modal medium:top-16">
          <Dialog.Title className="sr-only">{t('ui.console.palette.label')}</Dialog.Title>
          <PaletteBody {...props} />
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

/** The field and the results, mounted while the palette is open, so each opening starts on the first result. */
function PaletteBody({ onOpenChange, query, onQueryChange, groups, status = 'ready' }: CommandPaletteProps) {
  const listId = useId();
  const [active, setActive] = useState(0);
  const shown = status === 'ready' ? groups.filter((group) => group.items.length > 0) : [];
  const flat = shown.flatMap((group) => group.items);
  const firsts = shown.map((_, at) => shown.slice(0, at).reduce((sum, group) => sum + group.items.length, 0));
  const marked = Math.min(active, Math.max(0, flat.length - 1));
  const optionId = (index: number) => `${listId}-${index}`;
  useEffect(() => {
    document.getElementById(`${listId}-${marked}`)?.scrollIntoView?.({ block: 'nearest' });
  }, [listId, marked]);
  const choose = (item: PaletteItem | undefined) => {
    if (item === undefined) return;
    onOpenChange(false);
    item.onSelect();
  };
  return (
    <>
      <input type="text" role="combobox" aria-label={t('ui.console.palette.label')} aria-expanded={flat.length > 0} aria-controls={listId}
        aria-autocomplete="list" aria-activedescendant={flat.length > 0 ? optionId(marked) : undefined} autoComplete="off"
        value={query} placeholder={t('ui.console.palette.placeholder')}
        onChange={(event) => { setActive(0); onQueryChange(event.target.value); }}
        onKeyDown={(event) => moveOrChoose(event, flat.length, marked, { move: setActive, choose: () => choose(flat[marked]) })}
        className="h-header w-full shrink-0 border-b border-subtle-hover bg-transparent px-5 font-text text-16 text-content placeholder:text-content-muted focus:outline-none" />
      <div id={listId} role="listbox" aria-label={t('ui.console.palette.label')} className="max-h-palette-list overflow-y-auto p-2">
        {shown.map((group, at) => (
          <ResultGroup key={group.id} group={group} first={firsts[at] ?? 0} marked={marked} optionId={optionId} onMark={setActive} onChoose={choose} />
        ))}
        {flat.length === 0 ? <Instead status={status} query={query} /> : null}
      </div>
    </>
  );
}

interface ResultGroupProps {
  group: PaletteGroup;
  /** The index of the group's first result among all of them. */
  first: number;
  marked: number;
  optionId: (index: number) => string;
  onMark: (index: number) => void;
  onChoose: (item: PaletteItem) => void;
}

function ResultGroup({ group, first, marked, optionId, onMark, onChoose }: ResultGroupProps) {
  const headingId = useId();
  return (
    <div role="group" aria-labelledby={headingId}>
      <div id={headingId} className="px-3 pt-3 pb-1"><Text variant="eyebrow" tone="muted">{group.label}</Text></div>
      {group.items.map((item, at) => {
        const index = first + at;
        return (
          <div key={item.id} id={optionId(index)} role="option" aria-selected={index === marked}
            onMouseMove={() => onMark(index)} onClick={() => onChoose(item)}
            className={cx('flex min-h-touch cursor-pointer items-center justify-between gap-3 rounded-md px-3 font-text text-14 tablet:min-h-10',
              index === marked && 'bg-subtle-hover')}>
            <span className="min-w-0 truncate">{item.label}</span>
            {item.meta ? <span className="shrink-0 text-12 text-content-muted">{item.meta}</span> : null}
          </div>
        );
      })}
    </div>
  );
}
