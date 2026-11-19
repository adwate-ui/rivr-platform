import { t } from '@rivr/i18n';
import { tokens } from '@rivr/tokens';
import { useEffect, useRef, type FocusEvent, type ReactNode } from 'react';
import { Button } from '../Button/Button.tsx';
import { Icon } from '../Icon/Icon.tsx';
import { cx } from '../internal/classes.ts';

export interface SplitViewProps {
  /** The list: members, tables, tournaments. */
  list: ReactNode;
  /** The record opened from it, or null while none is. */
  detail: ReactNode | null;
  /** Below 1180 px, where the record replaces the list: the way back, such as "Back to Members". */
  backLabel: string;
  onBack: () => void;
  /**
   * Whether the record was chosen (#605); true unless said. A record shown only because none is chosen yet, such as the
   * floor's first table, sits beside the list from 1180 px, and below it the list stays until one is chosen.
   */
  isChosen?: boolean;
  /**
   * How the width is shared from 1180 px: `record`, three parts in five for the record (the default); `even`, half each,
   * a queue beside the item open (console v3: KYC review, Host queue, Website); `docked`, the record a 440 px panel at
   * the right and the list the rest, so a table of members keeps its names on one line (console v3: Members). The docked
   * record stays in view as the list scrolls, and one taller than the screen scrolls on its own (the owner, 15 Nov night).
   */
  layout?: 'record' | 'even' | 'docked';
  /**
   * From 1180 px, Close above a chosen record, and Escape at any width, give the list its width back (the owner, 17 Nov:
   * Members). Only where a screen gives it: elsewhere clearing the record would put another in its place, as KYC review
   * does, or lose an edit, as Content would.
   */
  onClose?: (() => void) | undefined;
  /**
   * Which record is open, such as the member's id. When it changes, the record starts at its top rather than where the last
   * one was scrolled to, as the docked panel scrolls on its own; the same record keeps its place as it draws again.
   */
  recordKey?: string | undefined;
}

/** Each layout's classes from 1180 px: the frame's, the list's alone and beside a record, and the record's. */
const LAYOUTS = {
  record: { frame: 'grid gap-6 tablet:grid-cols-5', alone: 'tablet:col-span-5', beside: 'tablet:col-span-2', record: 'tablet:col-span-3' },
  even: { frame: 'grid gap-6 tablet:grid-cols-2', alone: 'tablet:col-span-2', beside: 'tablet:col-span-1', record: 'tablet:col-span-1' },
  docked: {
    frame: 'flex flex-col gap-6 tablet:flex-row tablet:items-start', alone: 'tablet:flex-1', beside: 'tablet:flex-1',
    record: 'tablet:w-side-panel tablet:shrink-0 tablet:sticky tablet:top-0 tablet:max-h-console-view tablet:overflow-y-auto',
  },
} as const;

const CLOSE =
  'flex size-touch shrink-0 items-center justify-center rounded-md text-content transition-colors hover:bg-subtle ' +
  'focus-visible:outline focus-visible:outline-focus tablet:size-control';

// Where Escape belongs to something else: a field being typed in, or an open menu, list or dialog.
const OWNS_ESCAPE = 'input, textarea, select, [contenteditable="true"], [role="menu"], [role="listbox"], [role="dialog"], [role="alertdialog"]';

/** Escape closes the chosen record where the screen gives `onClose` (the owner, 17 Nov), unless a field, a menu or a dialog has it first. */
function useEscapeCloses(isOpen: boolean, onClose: (() => void) | undefined) {
  useEffect(() => {
    if (!isOpen || onClose === undefined) return undefined;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented) return;
      if (event.target instanceof Element && event.target.closest(OWNS_ESCAPE)) return;
      if (document.querySelector('[role="dialog"], [role="alertdialog"]')) return;
      onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);
}

const isWide = () => typeof window.matchMedia === 'function' && window.matchMedia(`(min-width: ${tokens.breakpoint.tablet}px)`).matches;

/** Close above a chosen record, from 1180 px, where the list stays beside it (the owner, 17 Nov); none without `onClose`. */
function CloseRecord({ onClose }: { onClose: (() => void) | undefined }) {
  if (onClose === undefined) return null;
  return (
    <div className="hidden w-full justify-end tablet:flex">
      <button type="button" aria-label={t('ui.splitView.close')} onClick={onClose} className={CLOSE}><Icon name="close" /></button>
    </div>
  );
}

/**
 * A list and the record opened from it (#603). From 1180 px they sit side by side, the record taking three parts in
 * five, half, or a docked panel (`layout`), with Close where the screen gives `onClose`; with no record open the list
 * takes the full width (C-03). Below, one shows at a time: the record replaces the list, with a way back to it.
 */
export function SplitView({ list, detail, backLabel, onBack, isChosen = true, layout = 'record', onClose, recordKey }: SplitViewProps) {
  const isOpen = detail !== null && isChosen;
  const { record, onListFocus } = useRecordFocus(isOpen);
  useEscapeCloses(isOpen, onClose);
  const panel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (panel.current !== null) panel.current.scrollTop = 0;
  }, [recordKey]);
  const look = LAYOUTS[layout];
  return (
    <div className={look.frame}>
      <div className={cx('min-w-0', detail === null ? look.alone : look.beside, isOpen ? 'hidden tablet:block' : '')}
        onFocus={onListFocus}>{list}</div>
      {detail === null ? null : (
        <div ref={panel} className={cx('min-w-0 flex-col items-start gap-4 tablet:flex', look.record, isOpen ? 'flex' : 'hidden')}>
          <div className="tablet:hidden">
            <Button variant="text" onClick={onBack}>{backLabel}</Button>
          </div>
          <CloseRecord onClose={isChosen ? onClose : undefined} />
          <div ref={record} tabIndex={-1} className="w-full min-w-0 focus-visible:outline focus-visible:outline-focus">{detail}</div>
        </div>
      )}
    </div>
  );
}

/**
 * Where focus goes as a record opens and closes. Below 1180 px the record replaces the list, so focus goes to the record
 * as it opens and back to what opened it as it closes: a keyboard or a screen reader is never left on a hidden list. From
 * 1180 px the list stays beside the record, so focus stays where it is as one opens, and goes back to the last thing used
 * in the list, such as the row that opened it, as it closes. A record open from the start keeps the page's focus.
 */
function useRecordFocus(isOpen: boolean) {
  const record = useRef<HTMLDivElement>(null);
  const openedFrom = useRef<HTMLElement | null>(null);
  const lastInList = useRef<HTMLElement | null>(null);
  const wasOpen = useRef(isOpen);
  useEffect(() => {
    if (isOpen === wasOpen.current) return;
    wasOpen.current = isOpen;
    if (isWide()) {
      if (!isOpen && lastInList.current?.isConnected === true) lastInList.current.focus();
      return;
    }
    if (isOpen) {
      openedFrom.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      record.current?.focus();
    } else {
      openedFrom.current?.focus();
      openedFrom.current = null;
    }
  }, [isOpen]);
  // Kept as the list is used, without drawing again.
  const onListFocus = (event: FocusEvent<HTMLDivElement>) => {
    if (event.target instanceof HTMLElement) lastInList.current = event.target;
  };
  return { record, onListFocus };
}
