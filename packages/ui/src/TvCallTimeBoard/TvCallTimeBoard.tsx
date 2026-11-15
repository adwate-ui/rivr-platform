import { TV_BOARD_ROOM, TV_BOARD_WIDTH } from '../internal/displayStage.tsx';
import { TvEmpty, TvMore, TvRow, tvRowHeight, tvRowsThatFit } from '../internal/tvList.tsx';
import { TvStage } from '../TvStage/TvStage.tsx';

/** A seat on call time: where ("Table 3 · seat 5"), the player (a first name and initial), and the time left ("25 min", "1 h 5 min", "Now" or "Away"). */
export interface TvCallTimeSeat {
  id: string;
  where: string;
  name: string;
  time: string;
}

export interface TvCallTimeBoardProps {
  /** The board's title: "Seats opening". */
  title: string;
  /** The seats, soonest first. */
  seats: readonly TvCallTimeSeat[];
  /** What the board says with nobody on call time: "No one on call time." */
  emptyText: string;
  /** Under a list cut short: "+3 more". */
  moreText: (hidden: number) => string;
}

// Two columns, 80 px between them.
const COLUMN_GAP = 80;
const COLUMN_WIDTH = (TV_BOARD_WIDTH - COLUMN_GAP) / 2;

/** How many seats the stage holds: they run across the two columns, so a pair of them is as tall as its taller one. */
function seatsThatFit(seats: readonly TvCallTimeSeat[]): number {
  const heights = seats.map((seat) => tvRowHeight({ isWide: true, name: seat.name, value: seat.time }, COLUMN_WIDTH));
  const pairs = Array.from({ length: Math.ceil(heights.length / 2) }, (_, pair) => Math.max(heights[pair * 2] ?? 0, heights[pair * 2 + 1] ?? 0));
  return Math.min(seats.length, tvRowsThatFit(pairs, TV_BOARD_ROOM) * 2);
}

/**
 * The TV's call-time board (decision 0163), titled Seats opening (owner, 15 Nov; redesign RD-28): one list in two columns,
 * read across, soonest first; each seat with where it is, the player and the call time left in gold. A name keeps its whole
 * width: the time goes under it before it is cut (correction 34). As many as the stage holds, then how many more. It holds
 * no state: the TV app passes the seats, already counted down and in order.
 */
export function TvCallTimeBoard({ title, seats, emptyText, moreText }: TvCallTimeBoardProps) {
  const shown = seatsThatFit(seats);
  return (
    <TvStage title={title}>
      {seats.length === 0 ? <TvEmpty text={emptyText} /> : (
        <ol className="grid grid-cols-2 content-start gap-x-20">
          {seats.slice(0, shown).map((seat) => <TvRow key={seat.id} isWide lead={seat.where} name={seat.name} value={seat.time} />)}
        </ol>
      )}
      <TvMore hidden={seats.length - shown} moreText={moreText} />
    </TvStage>
  );
}
