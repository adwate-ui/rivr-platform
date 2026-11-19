import { Icon } from '../Icon/Icon.tsx';
import { cx } from '../internal/classes.ts';
import { TONE, type TextTone } from '../internal/tone.ts';

export interface DetailRowProps {
  /** At the left: "Game", "Top-up", "House rules". */
  label: string;
  /** Under the label, small and muted, such as a line of history's day, "15 Nov"; the label is then in medium weight. */
  detail?: string | undefined;
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
  /** On a row that opens something, words a screen reader hears after what it shows: `Reverse`, for an action and not a place. */
  openHint?: string | undefined;
}

/**
 * One line of a ruled list (decision 0320): a label and its value, under a gold hairline. The seat's status lines, a
 * session's Game and Time, a redemption's Cost; with `onOpen`, a row that opens something, with its chevron.
 */
export function DetailRow({ size = 'body', isLast = false, onOpen, openHint, ...look }: DetailRowProps) {
  const row = cx('flex min-h-touch w-full items-center justify-between gap-3 border-t border-hairline py-3 text-start font-text',
    size === 'small' ? 'text-14' : 'text-16', isLast && 'border-b');
  if (onOpen) return <button type="button" className={cx(row, 'text-content')} onClick={onOpen}><RowBody {...look} hasChevron openHint={openHint} /></button>;
  return <div className={row}><RowBody {...look} hasChevron={false} /></div>;
}

type RowBodyProps = Pick<DetailRowProps, 'label' | 'detail' | 'value' | 'labelTone' | 'valueTone' | 'hasDot' | 'openHint'> & { hasChevron: boolean };

/** The label (with its dot, and any line under it), the value and, on a row that opens something, the chevron. */
function RowBody({ label, detail, value, labelTone = 'default', valueTone = 'default', hasDot = false, hasChevron, openHint }: RowBodyProps) {
  const shown = value === undefined ? null : <span className={cx('shrink-0 text-end', TONE[valueTone])}>{value}</span>;
  return (
    <>
      <span className={cx('flex min-w-0 items-center gap-2 wrap-anywhere', TONE[labelTone])}>
        {hasDot ? <span aria-hidden="true" className="size-pip shrink-0 rounded-full bg-gold" /> : null}
        {detail === undefined ? label : (
          <span className="flex min-w-0 flex-col gap-1">
            <span className="font-medium">{label}</span>
            <span className="text-12 text-content-muted">{detail}</span>
          </span>
        )}
      </span>
      {/* On a row that opens, the value and the chevron end it together: three apart, the value would float mid-row (#1077). */}
      {hasChevron ? (
        <span className="flex shrink-0 items-center gap-3">
          {shown}
          {/* The chevron's ink ends on the row's edge with the values and switches beside it, past its side bearing (F-157). */}
          <span className="-mr-1 text-content-muted"><Icon name="chevronRight" size="sm" /></span>
          {openHint === undefined ? null : <span className="sr-only">{openHint}</span>}
        </span>
      ) : shown}
    </>
  );
}
