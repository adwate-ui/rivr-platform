import { cx } from '../internal/classes.ts';

export interface TableListRowProps {
  /** "Table 1 · NLH 50/100". */
  name: string;
  /** Under the name: "Min buy-in ₹5,000". Left out, the row has no second line. */
  detail?: string | undefined;
  /** At the right: "No wait", "3 waiting", "Closed". Left out, nothing: the player app shows only that a table is closed (owner, 8 Nov). */
  wait?: string | undefined;
  /** No one waits: the wait is gold. */
  isNoWait?: boolean;
  /** Under the wait: "Full", "Opens later". Left out, nothing. Players never see how many seats are open (owner, 8 Nov). */
  seatsLine?: string | undefined;
  /** A closed table: 40% and not pressable. */
  isClosed?: boolean;
  /** Opens the table's join sheet. */
  onOpen?: (() => void) | undefined;
}

/** The row's right: the wait (gold when no one waits) and the line under it; nothing when neither is given. */
function Aside({ wait, isNoWait, seatsLine, isClosed }: Pick<TableListRowProps, 'wait' | 'seatsLine'> & { isNoWait: boolean; isClosed: boolean }) {
  if (wait === undefined && seatsLine === undefined) return null;
  return (
    <span className="flex shrink-0 flex-col items-end gap-1">
      {wait === undefined ? null : <span className={cx('font-text text-14', isNoWait && !isClosed ? 'text-accent' : 'text-content-muted')}>{wait}</span>}
      {seatsLine === undefined ? null : <span className="font-text text-12 text-content-muted">{seatsLine}</span>}
    </span>
  );
}

/**
 * A table in Tonight's list (decision 0320): its name and game with a line under it such as the minimum buy-in, the wait
 * at the right (gold when no one waits) and any line beneath it. The whole row opens the table; a closed one is dimmed
 * and inert.
 */
export function TableListRow({ name, detail, wait, isNoWait = false, seatsLine, isClosed = false, onOpen }: TableListRowProps) {
  const body = (
    <>
      <span className="flex min-w-0 flex-col gap-1">
        <span className="font-text text-16 font-medium">{name}</span>
        {detail === undefined ? null : <span className="font-text text-12 text-content-muted">{detail}</span>}
      </span>
      <Aside wait={wait} isNoWait={isNoWait} seatsLine={seatsLine} isClosed={isClosed} />
    </>
  );
  const row = 'flex min-h-touch w-full items-center justify-between gap-3 border-t border-hairline py-3 text-start text-content';
  if (isClosed || !onOpen) return <div className={cx(row, isClosed && 'opacity-disabled')}>{body}</div>;
  return <button type="button" className={row} onClick={onOpen}>{body}</button>;
}
