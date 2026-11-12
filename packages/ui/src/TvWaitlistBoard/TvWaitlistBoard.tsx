import { Heading } from '../Heading/Heading.tsx';
import { cx } from '../internal/classes.ts';

/** A place on the board: its number, the player (a first name and initial), and a status if called or away. */
export interface TvWaitlistPlace {
  id: string;
  place: string;
  name: string;
  status?: string | undefined;
}

/** One stake: its name ("₹100/200"), a line beside it ("2 tables open"), and its places in order. */
export interface TvWaitlistStake {
  id: string;
  stake: string;
  detail: string;
  places: readonly TvWaitlistPlace[];
}

export interface TvWaitlistBoardProps {
  /** The board's title: "Waitlist". */
  title: string;
  stakes: readonly TvWaitlistStake[];
  /** What a stake nobody waits for says: "No one waiting." */
  emptyText: string;
  /** Under a list cut short: "+3 more". Left out for a top-N list, which has no more to tell of. */
  moreText?: ((hidden: number) => string) | undefined;
  /** The line at the foot: "Page 1 of 2 · Table 4, Table 5: no list". */
  footer?: string | undefined;
}

// A page of a list an app pages itself (the wheel's prizes): what a column holds at any size.
export const TV_WAITLIST_PLACES_SHOWN = 5;

// Past these lengths a name and what is beside it will not share a row at 72 px: the name steps down a size, and what is beside
// it goes under it, rather than be cut (F-138).
const LONG_NAME = 11;
const LONG_STATUS = 14;

// The stage's heights as drawn at 1920 by 1080 (F-044): the room for a column's rows, under its head and above the progress bar,
// a row with what is beside it on its own row or not, and the lines that take room from them.
const COLUMN = { rows: 671, row: 101, stackedRow: 168, more: 48, footer: 56, detailLine: 54 } as const;
// The characters of a stake, in capitals at 48 px, on a line of a third or a half of the stage.
const DETAIL_ON_A_LINE = { narrow: 14, wide: 22 } as const;

function isStacked(place: TvWaitlistPlace, isNarrow: boolean): boolean {
  return place.status !== undefined && (isNarrow || place.name.length > LONG_NAME || place.status.length > LONG_STATUS);
}

/** How many of a column's places the stage holds, counting the rows with a status under the name; the rest go to "+N more". */
function placesThatFit(stake: TvWaitlistStake, isNarrow: boolean, hasFooter: boolean): number {
  const detailLines = Math.ceil(stake.detail.length / (isNarrow ? DETAIL_ON_A_LINE.narrow : DETAIL_ON_A_LINE.wide));
  const room = COLUMN.rows - (hasFooter ? COLUMN.footer : 0) - Math.max(0, detailLines - 1) * COLUMN.detailLine;
  const heights = stake.places.map((place) => (isStacked(place, isNarrow) ? COLUMN.stackedRow : COLUMN.row));
  if (heights.reduce((sum, height) => sum + height, 0) <= room) return heights.length;
  let used = COLUMN.more;
  let count = 0;
  for (const height of heights) {
    used += height;
    if (used > room) break;
    count += 1;
  }
  return count;
}

/**
 * How many of a column's places the stage holds with `columns` side by side, any more going to "+N more": for a board that
 * runs one ranked list down its columns, so column one ends where it fills and no place is hidden between them (decision 0581).
 */
export function tvPlacesThatFit(stake: TvWaitlistStake, columns: number): number {
  return placesThatFit(stake, columns > 2, false);
}

/** A place: its number, the name, and what is beside it: under the name where there is no room beside it. */
function PlaceRow({ place, isNarrow }: { place: TvWaitlistPlace; isNarrow: boolean }) {
  const status = place.status === undefined ? null : <span className="truncate whitespace-nowrap font-text text-48 text-money">{place.status}</span>;
  const stacks = isStacked(place, isNarrow);
  return (
    <li className="flex items-baseline gap-6 border-b border-hairline py-2">
      {place.place === '' ? null : <span className="w-20 shrink-0 font-text text-48 tabular-nums text-content">{place.place}</span>}
      <span className="flex min-w-0 flex-1 flex-col">
        <span className={cx('truncate font-text font-semibold leading-tight text-content', place.name.length > LONG_NAME ? 'text-56' : 'text-72')}>{place.name}</span>
        {stacks ? status : null}
      </span>
      {stacks ? null : status}
    </li>
  );
}

interface StakeColumnProps {
  stake: TvWaitlistStake;
  emptyText: string;
  moreText: ((hidden: number) => string) | undefined;
  isNarrow: boolean;
  hasFooter: boolean;
}

function StakeColumn({ stake, emptyText, moreText, isNarrow, hasFooter }: StakeColumnProps) {
  const shown = placesThatFit(stake, isNarrow, hasFooter);
  const hidden = stake.places.length - shown;
  return (
    <section aria-label={stake.stake} className="flex min-w-0 flex-col">
      <div className="flex flex-col gap-1 border-b border-hairline pb-3">
        <span className="truncate font-text text-56 font-medium leading-tight text-content">{stake.stake}</span>
        <span className="font-text text-48 uppercase leading-tight tracking-tv text-content">{stake.detail}</span>
      </div>
      {stake.places.length === 0 ? (
        <p className="py-6 font-text text-48 text-content">{emptyText}</p>
      ) : (
        <ol>{stake.places.slice(0, shown).map((place) => <PlaceRow key={place.id} place={place} isNarrow={isNarrow} />)}</ol>
      )}
      {hidden > 0 && moreText !== undefined ? <p className="pt-2 font-text text-36 leading-tight text-content">{moreText(hidden)}</p> : null}
    </section>
  );
}

/**
 * The TV's waitlist board (#65): the title in the display face on the wordmark's row, so the room reads the lists (F-138), then
 * the stakes side by side (two, or three when the venue has more, so all fit the stage), each with its places in order, a
 * player as a first name and initial, and as many as the stage holds, with how many more. It holds no state: the TV app passes
 * what to show.
 */
export function TvWaitlistBoard({ title, stakes, emptyText, moreText, footer }: TvWaitlistBoardProps) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="absolute inset-x-0 top-16 flex justify-center"><Heading level={1} variant="tvTitle">{title}</Heading></div>
      {stakes.length === 0 ? <p className="font-text text-48 text-content">{emptyText}</p> : (
        <div className={cx('grid min-h-0 flex-1 content-start gap-y-12', stakes.length > 2 ? 'grid-cols-3 gap-x-24' : 'grid-cols-2 gap-x-32')}>
          {stakes.map((stake) => <StakeColumn key={stake.id} stake={stake} emptyText={emptyText} moreText={moreText} isNarrow={stakes.length > 2} hasFooter={footer !== undefined} />)}
        </div>
      )}
      {footer === undefined ? null : <p className="pt-4 font-text text-36 uppercase leading-tight tracking-tv text-content">{footer}</p>}
    </div>
  );
}
