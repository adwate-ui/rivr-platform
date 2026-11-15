import { TV_BOARD_ROOM, TV_BOARD_WIDTH } from '../internal/displayStage.tsx';
import { TvEmpty, TvMore, TvRow, tvRowHeight, tvRowsThatFit } from '../internal/tvList.tsx';
import { TvStage } from '../TvStage/TvStage.tsx';

/** A place on the list: its number, the player (a first name and initial, or "Member #17"), and the time played ("5 h 39 min"). */
export interface TvHoursRow {
  id: string;
  place: string;
  name: string;
  time: string;
}

/** One list: the period it counts, in capitals over it ("Tonight"), and its places in order. */
export interface TvHoursList {
  id: string;
  caption: string;
  rows: readonly TvHoursRow[];
}

export interface TvHoursBoardProps {
  /** The board's title: "Most hours played". */
  title: string;
  /** The lists side by side: tonight, and a longer period. */
  lists: readonly TvHoursList[];
  /** What a list with nobody on it says, and the board with no lists: "No hours played yet." */
  emptyText: string;
  /** Under a list cut short: "+3 more". */
  moreText: (hidden: number) => string;
}

// Two columns, 80 px between them; a caption's line is 36, with 12 under it.
const COLUMN_GAP = 80;
const COLUMN_WIDTH = (TV_BOARD_WIDTH - COLUMN_GAP) / 2;
const CAPTION_HEIGHT = 48;

function HoursList({ list, emptyText, moreText }: { list: TvHoursList; emptyText: string; moreText: (hidden: number) => string }) {
  const heights = list.rows.map((row) => tvRowHeight({ name: row.name, value: row.time }, COLUMN_WIDTH));
  const shown = tvRowsThatFit(heights, TV_BOARD_ROOM - CAPTION_HEIGHT);
  return (
    <section aria-label={list.caption} className="flex min-w-0 flex-col">
      <h2 className="pb-3 font-text text-28 uppercase leading-snug tracking-tv text-content-muted">{list.caption}</h2>
      {list.rows.length === 0 ? <TvEmpty text={emptyText} /> : (
        <ol>{list.rows.slice(0, shown).map((row) => <TvRow key={row.id} lead={row.place} name={row.name} value={row.time} />)}</ol>
      )}
      <TvMore hidden={list.rows.length - shown} moreText={moreText} />
    </section>
  );
}

/**
 * The TV's hours leaderboard (decision 0581; redesign RD-28): the lists side by side, each under its period in capitals,
 * every place with its number, the player and the time played in gold. As many places as the stage holds, then how many
 * more. It holds no state: the TV app passes the lists in order.
 */
export function TvHoursBoard({ title, lists, emptyText, moreText }: TvHoursBoardProps) {
  return (
    <TvStage title={title}>
      {lists.length === 0 ? <TvEmpty text={emptyText} /> : (
        <div className="grid grid-cols-2 content-start gap-x-20">
          {lists.map((list) => <HoursList key={list.id} list={list} emptyText={emptyText} moreText={moreText} />)}
        </div>
      )}
    </TvStage>
  );
}
