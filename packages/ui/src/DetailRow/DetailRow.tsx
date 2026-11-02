import { Icon } from '../Icon/Icon.tsx';
import { cx } from '../internal/classes.ts';
import { TONE, type TextTone } from '../internal/tone.ts';

export interface DetailRowProps {
  /** At the left: "Game", "Top-up", "House rules". */
  label: string;
  /** At the right: "NLH 50/100", "Requested", "Verified". */
  value?: string | undefined;
  labelTone?: Extract<TextTone, 'default' | 'muted'>;
  valueTone?: Extract<TextTone, 'default' | 'muted' | 'accent'>;
  /** A small gold dot before the label: a request the seat has open. */
  hasDot?: boolean;
  /** `small`, 14 px, for the seat's status lines; otherwise 16. */
  size?: 'body' | 'small';
  /** Draws the hairline under the row as well: the last row of a ruled list. */
  isLast?: boolean;
  /** Makes the row a button with a chevron, such as Membership card or House rules. */
  onOpen?: (() => void) | undefined;
}

/**
 * One line of a ruled list (decision 0320): a label and its value, under a gold hairline. The seat's status lines, a
 * session's Game and Time, a redemption's Cost; with `onOpen`, a row that opens something, with its chevron.
 */
export function DetailRow({ size = 'body', isLast = false, onOpen, ...look }: DetailRowProps) {
  const row = cx('flex min-h-touch w-full items-center justify-between gap-3 border-t border-hairline py-3 text-start font-text',
    size === 'small' ? 'text-14' : 'text-16', isLast && 'border-b');
  if (onOpen) return <button type="button" className={cx(row, 'text-content')} onClick={onOpen}><RowBody {...look} hasChevron /></button>;
  return <div className={row}><RowBody {...look} hasChevron={false} /></div>;
}

type RowBodyProps = Pick<DetailRowProps, 'label' | 'value' | 'labelTone' | 'valueTone' | 'hasDot'> & { hasChevron: boolean };

/** The label (with its dot), the value and, on a row that opens something, the chevron. */
function RowBody({ label, value, labelTone = 'default', valueTone = 'default', hasDot = false, hasChevron }: RowBodyProps) {
  return (
    <>
      <span className={cx('flex items-center gap-2', TONE[labelTone])}>
        {hasDot ? <span aria-hidden="true" className="size-pip shrink-0 rounded-full bg-gold" /> : null}
        {label}
      </span>
      {value === undefined ? null : <span className={cx('text-end', TONE[valueTone])}>{value}</span>}
      {hasChevron ? <span className="text-content-muted"><Icon name="chevronRight" size="sm" /></span> : null}
    </>
  );
}
