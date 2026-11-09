import type { ReactNode } from 'react';
import { Icon } from '../Icon/Icon.tsx';
import { Text } from '../Text/Text.tsx';

export interface HistoryRowProps {
  /** When, above the title: `13 Feb 2026`. */
  when: string;
  /** What: `Table 2`. */
  title: string;
  /** The figure that matters, at the right, centred down the row: a session's time played, or a signed Money. */
  value: ReactNode;
  /** One line under the title: `100/200 · 6 h 30 min`. Left out, the row has no third line, and no room kept for one. */
  detail?: string | undefined;
  /** Opens the entry's detail. */
  onOpen: () => void;
}

/**
 * One past entry in a history, such as a played session, that opens to its detail (design prompt, "Sessions"; decision
 * 0320): when, what and any line of detail down the left, and the figure at the right, centred on them, as the prototype's
 * row. A button holds only phrasing content, so it is laid out with spans; a list of them sits in a divided Stack.
 */
export function HistoryRow({ when, title, value, detail, onOpen }: HistoryRowProps) {
  return (
    <button type="button" onClick={onOpen}
      className="flex min-h-touch w-full items-center justify-between gap-4 py-3 text-left focus-visible:outline focus-visible:outline-focus">
      <span className="flex min-w-0 flex-col gap-1">
        <Text as="span" variant="small" tone="muted">{when}</Text>
        <Text as="span" weight="medium">{title}</Text>
        {detail ? <Text as="span" variant="small" tone="muted">{detail}</Text> : null}
      </span>
      {/* The figure, wrapping when it is long, then the chevron every row that opens something has, its ink on the row's edge (F-211, as DetailRow). */}
      <span className="flex min-w-0 items-center gap-2 text-right">
        {value}
        <span className="-mr-1 shrink-0 text-content-muted"><Icon name="chevronRight" size="sm" /></span>
      </span>
    </button>
  );
}
