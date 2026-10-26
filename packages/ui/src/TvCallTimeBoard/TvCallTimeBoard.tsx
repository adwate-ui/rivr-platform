import { Heading } from '../Heading/Heading.tsx';
import { cx } from '../internal/classes.ts';

/** A seat about to open: where ("Table 3 · Seat 5"), who is leaving, and when ("In 25 min", or "Now" once call time is done). */
export interface TvCallTimeOpening {
  id: string;
  where: string;
  name: string;
  time: string;
  /** Call time is done: the seat opens now, and the time shows in the money colour. */
  isNow: boolean;
}

/** A player still playing their call time: the seat, the player (a first name and initial), and the time left ("1 h 20 min"). */
export interface TvCallTimeRow {
  id: string;
  seat: string;
  name: string;
  time: string;
}

/** A table on the board: its name, its game and stake beside it, and its players on call time. */
export interface TvCallTimeGroup {
  id: string;
  name: string;
  detail: string;
  rows: readonly TvCallTimeRow[];
}

export interface TvCallTimeBoardProps {
  /** The board's title: "Call time". */
  title: string;
  /** Above the seats about to open: "Seats opening". */
  openingsTitle: string;
  openings: readonly TvCallTimeOpening[];
  /** What the openings say when nobody is leaving: "No seats opening yet." */
  noOpeningsText: string;
  tables: readonly TvCallTimeGroup[];
  /** What the board says when no table has anyone on call time: "No one on call time." */
  emptyText: string;
  /** Under a list cut short: "+3 more". */
  moreText: (hidden: number) => string;
  /** Under the tables when they take turns, a page at a time: "Tables 1 to 4 of 6". */
  page?: string | undefined;
}

// What fits the 1920 by 1080 stage under the title: four openings, and four tables of four players, two by two.
// More tables take turns: the TV app passes a page of them at a time.
const SHOWN_OPENINGS = 4;
export const CALL_TIME_TABLES_SHOWN = 4;
const SHOWN_ROWS = 4;

function More({ hidden, moreText }: { hidden: number; moreText: (hidden: number) => string }) {
  return hidden > 0 ? <p className="pt-2 font-text text-24 text-content-muted">{moreText(hidden)}</p> : null;
}

interface OpeningsProps {
  title: string;
  openings: readonly TvCallTimeOpening[];
  emptyText: string;
  moreText: (hidden: number) => string;
}

function Openings({ title, openings, emptyText, moreText }: OpeningsProps) {
  return (
    <section aria-label={title} className="flex flex-col">
      <h2 className="border-b border-hairline pb-5 font-text text-28 uppercase tracking-tv text-content-muted">{title}</h2>
      {openings.length === 0 ? (
        <p className="py-6 font-text text-36 text-content-muted">{emptyText}</p>
      ) : (
        <ol>
          {openings.slice(0, SHOWN_OPENINGS).map((opening) => (
            <li key={opening.id} className="flex flex-col gap-2 border-b border-hairline py-3">
              <span className="truncate font-text text-28 text-content-muted">{opening.where}</span>
              <div className="flex items-baseline justify-between gap-6">
                <span className="min-w-0 truncate font-text text-36 font-medium text-content">{opening.name}</span>
                <span className={cx('shrink-0 whitespace-nowrap font-text text-36 font-medium tabular-nums', opening.isNow ? 'text-money' : 'text-content')}>
                  {opening.time}
                </span>
              </div>
            </li>
          ))}
        </ol>
      )}
      <More hidden={openings.length - SHOWN_OPENINGS} moreText={moreText} />
    </section>
  );
}

function TableColumn({ table, moreText }: { table: TvCallTimeGroup; moreText: (hidden: number) => string }) {
  return (
    <section aria-label={table.name} className="flex flex-col">
      <div className="flex items-baseline justify-between gap-6 border-b border-hairline pb-3">
        <span className="min-w-0 truncate font-text text-36 font-medium text-content">{table.name}</span>
        <span className="shrink-0 whitespace-nowrap font-text text-24 uppercase tracking-tv text-content-muted">{table.detail}</span>
      </div>
      <ol>
        {table.rows.slice(0, SHOWN_ROWS).map((row) => (
          <li key={row.id} className="flex items-baseline gap-6 border-b border-hairline py-1">
            <span className="w-12 shrink-0 font-text text-28 tabular-nums text-content-muted">{row.seat}</span>
            <span className="min-w-0 flex-1 truncate font-text text-28 font-medium text-content">{row.name}</span>
            <span className="shrink-0 whitespace-nowrap font-text text-28 tabular-nums text-content">{row.time}</span>
          </li>
        ))}
      </ol>
      <More hidden={table.rows.length - SHOWN_ROWS} moreText={moreText} />
    </section>
  );
}

/**
 * The TV's call-time board (decision 0163): the seats about to open, the players the floor marked
 * leaving with the call time they still owe, soonest first; beside them the tables with players
 * still on call time, each with the time left. A list cut short says how many more; more than four
 * tables take turns, a page at a time, which the app passes. It holds no state: the TV app passes what to show,
 * already counted down and in order.
 */
export function TvCallTimeBoard({ title, openingsTitle, openings, noOpeningsText, tables, emptyText, moreText, page }: TvCallTimeBoardProps) {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-12 pt-12">
      <Heading level={1} variant="tvTitle">{title}</Heading>
      <div className="grid min-h-0 flex-1 grid-cols-3 content-start gap-x-24">
        <Openings title={openingsTitle} openings={openings} emptyText={noOpeningsText} moreText={moreText} />
        {tables.length === 0 ? (
          <p className="col-span-2 font-text text-36 text-content-muted">{emptyText}</p>
        ) : (
          <div className="col-span-2 flex flex-col gap-6">
            <div className="grid grid-cols-2 content-start gap-x-16 gap-y-10">
              {tables.slice(0, CALL_TIME_TABLES_SHOWN).map((table) => <TableColumn key={table.id} table={table} moreText={moreText} />)}
            </div>
            {page === undefined ? null : <p className="font-text text-24 uppercase tracking-tv text-content-muted">{page}</p>}
          </div>
        )}
      </div>
    </div>
  );
}
