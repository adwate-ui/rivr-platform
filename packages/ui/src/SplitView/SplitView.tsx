import { tokens } from '@rivr/tokens';
import { useEffect, useRef, type ReactNode } from 'react';
import { Button } from '../Button/Button.tsx';
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
   * the right and the list the rest, so a table of members keeps its names on one line (console v3: Members).
   */
  layout?: 'record' | 'even' | 'docked';
}

/** Each layout's classes from 1180 px: the frame's, the list's alone and beside a record, and the record's. */
const LAYOUTS = {
  record: { frame: 'grid gap-6 tablet:grid-cols-5', alone: 'tablet:col-span-5', beside: 'tablet:col-span-2', record: 'tablet:col-span-3' },
  even: { frame: 'grid gap-6 tablet:grid-cols-2', alone: 'tablet:col-span-2', beside: 'tablet:col-span-1', record: 'tablet:col-span-1' },
  docked: { frame: 'flex flex-col gap-6 tablet:flex-row tablet:items-start', alone: 'tablet:flex-1', beside: 'tablet:flex-1', record: 'tablet:w-side-panel tablet:shrink-0' },
} as const;

/**
 * A list and the record opened from it (#603). From 1180 px they sit side by side, the record taking three parts in
 * five, half, or a docked panel (`layout`); with no record open the list takes the full width (C-03). Below, one shows
 * at a time: the record replaces the list, with a way back to it.
 */
export function SplitView({ list, detail, backLabel, onBack, isChosen = true, layout = 'record' }: SplitViewProps) {
  const record = useRef<HTMLDivElement>(null);
  const openedFrom = useRef<HTMLElement | null>(null);
  const isOpen = detail !== null && isChosen;
  const wasOpen = useRef(isOpen);
  // Below 1180 px the record replaces the list, so focus goes to the record as it opens and back to what opened it as
  // it closes: a keyboard or a screen reader is never left on a hidden list. A record open from the start keeps the page's focus.
  useEffect(() => {
    if (isOpen === wasOpen.current) return;
    wasOpen.current = isOpen;
    // From 1180 px the list stays beside the record, so focus stays where it is.
    if (typeof window.matchMedia === 'function' && window.matchMedia(`(min-width: ${tokens.breakpoint.tablet}px)`).matches) return;
    if (isOpen) {
      openedFrom.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      record.current?.focus();
    } else {
      openedFrom.current?.focus();
      openedFrom.current = null;
    }
  }, [isOpen]);
  const look = LAYOUTS[layout];
  return (
    <div className={look.frame}>
      <div className={cx('min-w-0', detail === null ? look.alone : look.beside, isOpen ? 'hidden tablet:block' : '')}>{list}</div>
      {detail === null ? null : (
        <div className={cx('min-w-0 flex-col items-start gap-4 tablet:flex', look.record, isOpen ? 'flex' : 'hidden')}>
          <div className="tablet:hidden">
            <Button variant="text" onClick={onBack}>{backLabel}</Button>
          </div>
          <div ref={record} tabIndex={-1} className="w-full min-w-0 focus-visible:outline focus-visible:outline-focus">{detail}</div>
        </div>
      )}
    </div>
  );
}
