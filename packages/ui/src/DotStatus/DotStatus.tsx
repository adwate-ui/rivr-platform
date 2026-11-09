import { cx } from '../internal/classes.ts';

/**
 * `needsYou`, gold, for what waits on the staff member, the only gold status (console v3); `active`, cream, as Waiting or
 * seated; `inactive`, a faint dot and muted words, as Left or Paused; `danger`, the console's danger red, as KYC pending.
 */
export type DotStatusTone = 'needsYou' | 'active' | 'inactive' | 'danger';

export interface DotStatusProps {
  tone: DotStatusTone;
  /** Already translated, short enough for a table cell: "Waiting", "T2 · 3". */
  label: string;
  /**
   * The status in full where the label shortens it, "Table 2, seat 3": a tooltip for the pointer, and what a screen
   * reader reads in the label's place.
   */
  title?: string | undefined;
}

const DOT: Record<DotStatusTone, string> = { needsYou: 'bg-gold', active: 'bg-cream', inactive: 'bg-cream-faint', danger: 'bg-danger' };

// Muted words only beside the faint dot; the rest in cream, on the page or a raised surface, never on a fill.
const WORDS: Record<DotStatusTone, string> = { needsYou: 'text-content', active: 'text-content', inactive: 'text-content-muted', danger: 'text-content' };

/** A status as a 6 px dot and its words, never the colour alone (console v3): a member's state in a row, a promotion's. */
export function DotStatus({ tone, label, title }: DotStatusProps) {
  return (
    <span title={title} className={cx('inline-flex max-w-full min-w-0 items-center gap-2 font-text text-13 leading-control', WORDS[tone])}>
      <span data-dot="" aria-hidden="true" className={cx('size-pip shrink-0 rounded-full', DOT[tone])} />
      {title === undefined ? <span title={label} className="min-w-0 truncate">{label}</span> : (
        <>
          <span aria-hidden="true" className="min-w-0 truncate">{label}</span>
          <span className="sr-only">{title}</span>
        </>
      )}
    </span>
  );
}
