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
}

// The prototype's TV fits six places under each stake, two stakes to a row.
const SHOWN = 6;

function StakeColumn({ stake, emptyText }: { stake: TvWaitlistStake; emptyText: string }) {
  return (
    <section aria-label={stake.stake} className="flex flex-col">
      <div className="flex items-baseline justify-between border-b border-hairline pb-5">
        <span className="font-text text-56 font-medium text-content">{stake.stake}</span>
        <span className="font-text text-24 uppercase tracking-tv text-content-muted">{stake.detail}</span>
      </div>
      {stake.places.length === 0 ? (
        <p className="py-6 font-text text-36 text-content-muted">{emptyText}</p>
      ) : (
        <ol>
          {stake.places.slice(0, SHOWN).map((place) => (
            <li key={place.id} className="flex items-baseline gap-6 border-b border-hairline py-5">
              <span className="w-20 shrink-0 font-text text-36 tabular-nums text-content-muted">{place.place}</span>
              <span className="min-w-0 flex-1 truncate font-text text-48 font-medium text-content">{place.name}</span>
              {place.status === undefined ? null : <span className="font-text text-28 text-money">{place.status}</span>}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

/**
 * The TV's waitlist board (#65), as in the prototype: the title in the display face, then the stakes
 * side by side (two, as in the prototype, or three when the venue has more, so all fit the stage),
 * each with its places in order, a player as a first name and initial. It holds no state: the TV app
 * passes what to show.
 */
export function TvWaitlistBoard({ title, stakes, emptyText }: TvWaitlistBoardProps) {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-12 pt-12">
      <Heading level={1} variant="tvTitle">{title}</Heading>
      <div className={cx('grid min-h-0 flex-1 content-start gap-y-12', stakes.length > 2 ? 'grid-cols-3 gap-x-24' : 'grid-cols-2 gap-x-32')}>
        {stakes.map((stake) => <StakeColumn key={stake.id} stake={stake} emptyText={emptyText} />)}
      </div>
    </div>
  );
}
