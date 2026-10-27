import type { ReactNode } from 'react';
import { Text } from '../Text/Text.tsx';

export interface HistoryRowProps {
  /** When, above the title: `13 Feb 2026`. */
  when: string;
  /** What: `Table 2`. */
  title: string;
  /** The figure that matters, beside the title: a session's net as a signed Money. */
  value: ReactNode;
  /** One line under the title: `100/200 · 6 h 30 min`. */
  detail: string;
  /** Opens the entry's detail. */
  onOpen: () => void;
}

/**
 * One past entry in a history, such as a played session, that opens to its detail (design prompt, "Sessions"):
 * when, then what with its figure, then a line of detail. A button holds only phrasing content, so it is laid out
 * with spans; a list of them sits in a divided Stack.
 */
export function HistoryRow({ when, title, value, detail, onOpen }: HistoryRowProps) {
  return (
    <button type="button" onClick={onOpen}
      className="flex min-h-touch w-full flex-col gap-1 py-3 text-left focus-visible:outline-2 focus-visible:outline-focus">
      <Text as="span" variant="small" tone="muted">{when}</Text>
      <span className="flex items-baseline justify-between gap-4">
        <Text as="span" weight="medium">{title}</Text>
        {value}
      </span>
      <Text as="span" variant="small" tone="muted">{detail}</Text>
    </button>
  );
}
