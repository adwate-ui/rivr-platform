import { useId } from 'react';
import { cx } from '../internal/classes.ts';
import { Money } from '../Money/Money.tsx';
import { SeatRing, type RingSeat } from '../SeatRing/SeatRing.tsx';
import { Text } from '../Text/Text.tsx';

export interface TableCardProps {
  /** The table's name: "Table 3", the button's name. */
  name: string;
  /** Its stakes on the felt: "100/200". */
  stakes: string;
  seats: readonly RingSeat[];
  /** What a screen reader hears for the ring: "Table 3, 8 of 9 seats taken". */
  ringLabel: string;
  isClosed?: boolean;
  /** Under the ring, left: "8 of 9", or "Closed". */
  occupancy: string;
  /** Under the ring, right: rake tonight; null for staff who do not read the ledger. */
  rake: bigint | null;
  /** The dealer now, or "No dealer"; null for staff who do not see the night's figures. */
  dealer: string | null;
  /** Hands in the last hour: "30 hands/hr"; null for staff who do not see the night's figures. */
  pace: string | null;
  isSelected?: boolean;
  /** Something waiting at the table that the floor must see, such as a top-up (decision 0299): a red marker under the ring. */
  marker?: string | undefined;
  onSelect: () => void;
}

// A button holds only phrasing content, so the card is laid out with spans.
const ROW = 'flex items-baseline justify-between gap-4';

/**
 * One table on the live floor's room plan, as in the prototype (#81): its seat ring, how many sit
 * there and its rake tonight, its dealer and hands per hour. Pressing it opens the table beside; a
 * screen reader hears the table's name, then the ring's summary and the figures.
 */
export function TableCard({ name, stakes, seats, ringLabel, isClosed = false, occupancy, rake, dealer, pace, isSelected = false, marker, onSelect }: TableCardProps) {
  const id = useId();
  return (
    <button type="button" aria-label={name} aria-describedby={`${id}-ring ${id}-figures`} aria-pressed={isSelected} onClick={onSelect}
      className={cx('flex w-full flex-col gap-2 rounded-md border bg-raised p-4 text-left focus-visible:outline-2 focus-visible:outline-focus',
        isSelected ? 'border-cream' : 'border-hairline')}>
      <SeatRing name={name} stakes={stakes} seats={seats} label={ringLabel} isClosed={isClosed} />
      <span id={`${id}-ring`} className="sr-only">{ringLabel}</span>
      <span id={`${id}-figures`} className="flex flex-col gap-2">
        <span className={ROW}>
          <Text as="span" variant="small" tone="muted">{occupancy}</Text>
          {rake === null ? null : <Money paise={rake} />}
        </span>
        {marker === undefined ? null : (
          <span className="w-fit rounded-md bg-alert px-2 font-text text-14 font-medium text-on-alert">{marker}</span>
        )}
        {dealer === null && pace === null ? null : (
          <span className={ROW}>
            {dealer === null ? null : <Text as="span" variant="small" tone="muted">{dealer}</Text>}
            {pace === null ? null : <Text as="span" variant="small" tone="muted">{pace}</Text>}
          </span>
        )}
      </span>
    </button>
  );
}
