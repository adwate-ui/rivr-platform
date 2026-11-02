import { cx } from '../internal/classes.ts';

export interface TableListRowProps {
  /** "Table 1 · NLH 50/100". */
  name: string;
  /** Seats at the table: nine dots unless given. */
  seatCount?: number;
  /** How many of them are open: gold dots, after the taken ones. */
  openSeats: number;
  /** The wait at the right: "No wait", "3 waiting", "Closed". */
  wait: string;
  /** No one waits: the wait is gold. */
  isNoWait?: boolean;
  /** Under the wait: "3 open", "Full", "Opens later". */
  seatsLine: string;
  /** A closed table: 40% and not pressable. */
  isClosed?: boolean;
  /** Opens the table's join sheet. */
  onOpen?: (() => void) | undefined;
}

/** The nine dots: taken first, cream at 35%, then the open ones gold; all faint while the table is closed. */
function SeatDots({ seatCount, openSeats, isClosed }: { seatCount: number; openSeats: number; isClosed: boolean }) {
  return (
    <span aria-hidden="true" className="flex gap-1">
      {Array.from({ length: seatCount }, (_, index) => {
        const isOpen = !isClosed && index >= seatCount - openSeats;
        return <span key={index} className={cx('size-pip rounded-full', isClosed ? 'bg-cream-faint' : isOpen ? 'bg-gold' : 'bg-seat-taken')} />;
      })}
    </span>
  );
}

/**
 * A table in Tonight's list (decision 0320): its name and game, a dot for each seat, the wait at the right (gold when no
 * one waits) and how many seats are open beneath. The whole row opens the table; a closed one is dimmed and inert.
 */
export function TableListRow({ name, seatCount = 9, openSeats, wait, isNoWait = false, seatsLine, isClosed = false, onOpen }: TableListRowProps) {
  const body = (
    <>
      <span className="flex min-w-0 flex-col gap-2">
        <span className="font-text text-16 font-medium">{name}</span>
        <SeatDots seatCount={seatCount} openSeats={openSeats} isClosed={isClosed} />
      </span>
      <span className="flex shrink-0 flex-col items-end gap-1">
        <span className={cx('font-text text-14', isNoWait && !isClosed ? 'text-accent' : 'text-content-muted')}>{wait}</span>
        <span className="font-text text-12 text-content-muted">{seatsLine}</span>
      </span>
    </>
  );
  const row = 'flex min-h-touch w-full items-center justify-between gap-3 border-t border-hairline py-3 text-start text-content';
  if (isClosed || !onOpen) return <div className={cx(row, isClosed && 'opacity-disabled')}>{body}</div>;
  return <button type="button" className={row} onClick={onOpen}>{body}</button>;
}
