import { useEffect, useRef, type ReactNode } from 'react';
import { Button } from '../Button/Button.tsx';
import { cx } from '../internal/classes.ts';
import { Text } from '../Text/Text.tsx';

export interface SplitViewProps {
  /** The list: members, tables, tournaments. */
  list: ReactNode;
  /** The record opened from it, or null while none is. */
  detail: ReactNode | null;
  /** Below 1180 px, where the record replaces the list: the way back, such as "Back to Members". */
  backLabel: string;
  onBack: () => void;
  /** From 1180 px, beside the list while no record is open: what to do, such as "Choose a member to see their record." */
  emptyText: string;
}

/**
 * A list and the record opened from it (#603). From 1180 px they sit side by side, the record taking three parts in
 * five. Below, one shows at a time: the record replaces the list, with a way back to it.
 */
export function SplitView({ list, detail, backLabel, onBack, emptyText }: SplitViewProps) {
  const record = useRef<HTMLDivElement>(null);
  const openedFrom = useRef<HTMLElement | null>(null);
  const isOpen = detail !== null;
  const wasOpen = useRef(isOpen);
  // Below 1180 px the record replaces the list, so focus goes to the record as it opens and back to what opened it as
  // it closes: a keyboard or a screen reader is never left on a hidden list. A record open from the start keeps the page's focus.
  useEffect(() => {
    if (isOpen === wasOpen.current) return;
    wasOpen.current = isOpen;
    if (isOpen) {
      openedFrom.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      record.current?.focus();
    } else {
      openedFrom.current?.focus();
      openedFrom.current = null;
    }
  }, [isOpen]);
  return (
    <div className="grid gap-6 tablet:grid-cols-5">
      <div className={cx('min-w-0 tablet:col-span-2', detail === null ? '' : 'hidden tablet:block')}>{list}</div>
      {detail === null ? (
        <div className="hidden tablet:col-span-3 tablet:block">
          <Text tone="muted">{emptyText}</Text>
        </div>
      ) : (
        <div className="flex min-w-0 flex-col items-start gap-4 tablet:col-span-3">
          <div className="tablet:hidden">
            <Button variant="text" onClick={onBack}>{backLabel}</Button>
          </div>
          <div ref={record} tabIndex={-1} className="w-full min-w-0 focus-visible:outline-2 focus-visible:outline-focus">{detail}</div>
        </div>
      )}
    </div>
  );
}
