import { cx } from '../internal/classes.ts';
import { TV_BOARD_ROOM } from '../internal/displayStage.tsx';
import { TV_MORE_HEIGHT, TV_ROW_HEIGHT, TvEmpty, TvMore, tvRowsThatFit } from '../internal/tvList.tsx';
import { TvStage } from '../TvStage/TvStage.tsx';

/** A place on the board: its number, the player (a first name and initial), and a status if called or away. */
export interface TvWaitlistPlace {
  id: string;
  place: string;
  name: string;
  status?: string | undefined;
}

/** One column: a table's name ("Table 1"), the line under it in capitals (its game and stake, "NLH 50/100"), and its places in order. */
export interface TvWaitlistStake {
  id: string;
  stake: string;
  detail: string;
  places: readonly TvWaitlistPlace[];
}

export interface TvWaitlistBoardProps {
  /** The board's title: "Waitlist". */
  title: string;
  /** The columns, in order: four to a row, and a second row for more than four. */
  stakes: readonly TvWaitlistStake[];
  /** What the board says with no columns, and a column nobody waits in: "No one waiting." */
  emptyText: string;
  /** Under a list cut short: "+3 more". */
  moreText?: ((hidden: number) => string) | undefined;
  /** Under the columns when they take turns, a page at a time: "Page 1 of 2". */
  footer?: string | undefined;
}

/** The columns the stage holds, two rows of four: more take turns, a page at a time, which the app passes. */
export const TV_WAITLIST_TABLES_SHOWN = 8;
const COLUMNS_A_ROW = 4;

// Heights at 1920 by 1080. A column's head: the name's line (49), each line of the stake (32) and the rule under them
// (14). A row with a status under the name is the status's line (36) taller. Rows of columns stand 48 apart.
const HEAD = { name: 49, detailLine: 32, rule: 14 } as const;
const STATUS_HEIGHT = 36;
const ROW_GAP = 48;
// The characters of a stake line, in spaced capitals at 24 px, across a column of a quarter of the stage.
const DETAIL_ON_A_LINE = 20;
// Past this a name does not fit its column at 48 px: it steps down a size rather than be cut.
const LONG_NAME = 13;

/** How many of a column's places fit `room` px under its head, counting a status under a name; the rest go to "+N more". */
function placesThatFit(stake: TvWaitlistStake, room: number): number {
  const detailLines = Math.max(1, Math.ceil(stake.detail.length / DETAIL_ON_A_LINE));
  const head = HEAD.name + detailLines * HEAD.detailLine + HEAD.rule;
  return tvRowsThatFit(stake.places.map((place) => TV_ROW_HEIGHT + (place.status === undefined ? 0 : STATUS_HEIGHT)), room - head);
}

/** A place: its number muted, the name large, and its status under the name, so the two never share the column's width. */
function PlaceRow({ place }: { place: TvWaitlistPlace }) {
  return (
    <li className="flex items-baseline gap-6 border-b border-hairline py-4">
      {place.place === '' ? null : <span className="w-10 shrink-0 font-text text-28 tabular-nums text-content-muted">{place.place}</span>}
      <span className="flex min-w-0 flex-1 flex-col">
        <span className={cx('truncate font-text font-semibold leading-snug text-content', place.name.length > LONG_NAME ? 'text-36' : 'text-48')}>
          {place.name === '' ? <>&nbsp;</> : place.name}
        </span>
        {place.status === undefined ? null : <span className="font-text text-28 leading-snug text-money">{place.status}</span>}
      </span>
    </li>
  );
}

interface TableColumnProps {
  stake: TvWaitlistStake;
  room: number;
  emptyText: string;
  moreText: ((hidden: number) => string) | undefined;
}

function TableColumn({ stake, room, emptyText, moreText }: TableColumnProps) {
  const shown = placesThatFit(stake, room);
  return (
    <section aria-label={stake.stake} className="flex min-w-0 flex-col">
      <div className="flex flex-col border-b-2 border-hairline pb-3">
        <h2 className="truncate font-text text-44 font-semibold leading-tight text-content">{stake.stake}</h2>
        <span className="font-text text-24 uppercase leading-snug tracking-tv text-content-muted">{stake.detail}</span>
      </div>
      {stake.places.length === 0 ? <div className="py-4"><TvEmpty text={emptyText} /></div> : (
        <ol>{stake.places.slice(0, shown).map((place) => <PlaceRow key={place.id} place={place} />)}</ol>
      )}
      <TvMore hidden={stake.places.length - shown} moreText={moreText} />
    </section>
  );
}

/**
 * The TV's waitlist board (#65; redesign RD-28): each table somebody waits for is a column, its name, its game and stake
 * under it in capitals, then its places, the number muted and the player large as a first name and initial. Four columns
 * to a row, a second row for more; each column holds as many places as its share of the stage, then how many more. It
 * holds no state: the TV app passes what to show.
 */
export function TvWaitlistBoard({ title, stakes, emptyText, moreText, footer }: TvWaitlistBoardProps) {
  const shown = stakes.slice(0, TV_WAITLIST_TABLES_SHOWN);
  const rows = shown.length > COLUMNS_A_ROW ? 2 : 1;
  const room = (TV_BOARD_ROOM - (footer === undefined ? 0 : TV_MORE_HEIGHT) - (rows - 1) * ROW_GAP) / rows;
  return (
    <TvStage title={title}>
      {shown.length === 0 ? <TvEmpty text={emptyText} /> : (
        <div className="grid grid-cols-4 content-start gap-12">
          {shown.map((stake) => <TableColumn key={stake.id} stake={stake} room={room} emptyText={emptyText} moreText={moreText} />)}
        </div>
      )}
      {footer === undefined ? null : <p className="mt-auto pt-3 font-text text-28 leading-snug text-content-muted">{footer}</p>}
    </TvStage>
  );
}
