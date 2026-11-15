import { cx } from '../internal/classes.ts';

/** A hand the promotion pays, and its Bonus: "Royal flush", "25,000". */
export interface TvHighHandListed {
  id: string;
  name: string;
  bonus: string;
}

/** A payout of tonight: who (a first name and initial), the hand, table and time on a line, and the Bonus paid. */
export interface TvHighHandPaid {
  id: string;
  name: string;
  /** "Four Jacks · Table 2 · 02:43". */
  detail: string;
  bonus: string;
  /** Just paid: the row is lit. */
  isNew?: boolean;
}

export interface TvHighHandBoardProps {
  /** Above the hands: "Hit one, get paid". */
  handsTitle: string;
  hands: readonly TvHighHandListed[];
  /** Under the hands, the rules on a line: "Both hole cards must play · Shown at showdown · 4 or more players dealt in". */
  rules: string;
  /** Above the payouts: "Paid tonight". */
  payoutsTitle: string;
  /** Tonight's payouts, the newest first; the board shows the newest six. */
  payouts: readonly TvHighHandPaid[];
  /** What the payouts say with none yet: "None yet tonight." */
  emptyText: string;
}

// What fits the stage's body (1760 by 739 under the title, redesign RD-28) at a size read from across the room: the
// list's five hands with the rules under them, and six payouts.
const SHOWN_PAYOUTS = 6;

const LABEL = 'pb-3 font-text text-24 font-medium uppercase leading-snug tracking-tv text-content-muted';

function Hands({ title, hands, rules }: { title: string; hands: readonly TvHighHandListed[]; rules: string }) {
  return (
    <section aria-label={title} className="flex min-w-0 flex-col">
      <h2 className={LABEL}>{title}</h2>
      <ul>
        {hands.map((hand) => (
          <li key={hand.id} className="flex items-baseline justify-between gap-6 border-b border-hairline py-4">
            <span className="font-text text-48 font-semibold leading-tight text-content">{hand.name}</span>
            <span className="shrink-0 font-text text-48 leading-tight tabular-nums text-accent">{hand.bonus}</span>
          </li>
        ))}
      </ul>
      <p className="pt-5 font-text text-36 leading-snug text-content-muted">{rules}</p>
    </section>
  );
}

function Payouts({ title, payouts, emptyText }: { title: string; payouts: readonly TvHighHandPaid[]; emptyText: string }) {
  return (
    <section aria-label={title} className="flex min-w-0 flex-col">
      <h2 className={LABEL}>{title}</h2>
      {payouts.length === 0 ? <p className="py-4 font-text text-36 leading-snug text-content-muted">{emptyText}</p> : (
        <ol>
          {payouts.slice(0, SHOWN_PAYOUTS).map((payout) => (
            <li key={payout.id} className={cx('flex items-center justify-between gap-6 border-b border-hairline px-4 py-3', payout.isNew === true && 'rounded-md bg-subtle')}>
              <div className="flex min-w-0 flex-col">
                {/* The name is never cut: the line under it gives way first (redesign correction 34). */}
                <span className="whitespace-nowrap font-text text-36 font-semibold leading-tight text-content">{payout.name}</span>
                <span className="truncate font-text text-24 leading-snug text-content-muted">{payout.detail}</span>
              </div>
              <span className="shrink-0 font-text text-48 leading-tight tabular-nums text-accent">{payout.bonus}</span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

/**
 * The body of the TV's High hand bonus board (redesign RD-25): on the left the hands and their Bonus with the rules under
 * them, on the right tonight's payouts, the newest first and lit when just paid. The stage round it draws the title, the
 * clock and the notice line; the board draws none of them.
 */
export function TvHighHandBoard({ handsTitle, hands, rules, payoutsTitle, payouts, emptyText }: TvHighHandBoardProps) {
  return (
    <div className="grid h-full w-full grid-cols-2 gap-16">
      <Hands title={handsTitle} hands={hands} rules={rules} />
      <Payouts title={payoutsTitle} payouts={payouts} emptyText={emptyText} />
    </div>
  );
}
