import { formatMoney } from '@rivr/i18n';
import { Heading } from '../Heading/Heading.tsx';
import { Text } from '../Text/Text.tsx';

/** A figure under the clock: its label ("Players") and its value as shown ("31", "₹5,22,000"). */
export interface TvTournamentStat {
  label: string;
  value: string;
}

/** A paid place: "1", and what it pays in paise. */
export interface TvTournamentPayout {
  place: string;
  amount: bigint;
}

export interface TvTournamentClockProps {
  /** The tournament's name, letter-spaced above the level: "RIVR Sunday". */
  name: string;
  /** "Level 7". */
  level: string;
  /** The level's time left, as the clock shows it: "11:29". */
  remaining: string;
  /** Beside the clock when it is not running: "Paused". */
  status?: string | undefined;
  /** The blinds in chips: "400/800". */
  blinds: string;
  /** "Ante 800"; absent without an ante. */
  ante?: string | undefined;
  /** The next level: "Next 500/1,000 ante 1,000"; absent on the last level. */
  next?: string | undefined;
  /** Players left, entries, the average stack and the pool, in that order. */
  stats: readonly TvTournamentStat[];
  /** "Payouts". */
  payoutsLabel: string;
  payouts: readonly TvTournamentPayout[];
  /** What shows before the payouts are set: "Payouts are set when registration closes." */
  noPayoutsText: string;
}

// The stage fits nine paid places beside the clock; a bigger field's later places are on the app and the console.
const SHOWN = 9;

function Payouts({ label, payouts, emptyText }: { label: string; payouts: readonly TvTournamentPayout[]; emptyText: string }) {
  return (
    <section aria-label={label} className="col-span-1 flex flex-col gap-6 border-l border-hairline pl-16">
      <Text variant="tvLabel" tone="muted">{label}</Text>
      {payouts.length === 0 ? (
        <Text variant="tvBody" tone="muted">{emptyText}</Text>
      ) : (
        <ol>
          {payouts.slice(0, SHOWN).map((payout) => (
            <li key={payout.place} className="flex items-baseline justify-between border-t border-hairline py-3">
              <span className="font-text text-36 leading-tight tabular-nums text-content-muted">{payout.place}</span>
              <span className="font-text text-44 font-medium leading-tight tabular-nums text-content">{formatMoney(payout.amount)}</span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

/**
 * The TV's tournament clock (#64), as in the prototype: the tournament and its level, the level's
 * time left as the largest figure, the blinds and ante, the next level, then players, entries,
 * average stack and pool; the first nine payouts down the right. It holds no state: the TV passes what to show.
 */
export function TvTournamentClock({ name, level, remaining, status, blinds, ante, next, stats, payoutsLabel, payouts, noPayoutsText }: TvTournamentClockProps) {
  return (
    <div className="grid min-h-0 flex-1 grid-cols-4 gap-x-16 pt-8">
      <div className="col-span-3 flex flex-col">
        <Text variant="tvLabel" tone="muted">{name}</Text>
        <Heading level={1} variant="poster">{level}</Heading>
        <div className="flex items-baseline gap-12">
          <span role="timer" className="font-text text-280 font-medium leading-tight tabular-nums text-content">{remaining}</span>
          {status === undefined ? null : <Text variant="tvBody" tone="muted">{status}</Text>}
        </div>
        <div className="flex items-baseline gap-10">
          <span className="font-text text-96 font-medium leading-tight tabular-nums text-content">{blinds}</span>
          {ante === undefined ? null : <span className="font-text text-48 leading-tight tabular-nums text-content">{ante}</span>}
        </div>
        {next === undefined ? null : <div className="pt-4"><Text variant="tvLabel" tone="muted">{next}</Text></div>}
        <dl className="mt-auto flex justify-between gap-x-12 border-t border-hairline pt-8">
          {stats.map((stat) => (
            <div key={stat.label} className="flex flex-col gap-2">
              <dt><Text variant="tvLabel" tone="muted">{stat.label}</Text></dt>
              <dd className="font-text text-56 font-medium leading-tight tabular-nums text-content">{stat.value}</dd>
            </div>
          ))}
        </dl>
      </div>
      <Payouts label={payoutsLabel} payouts={payouts} emptyText={noPayoutsText} />
    </div>
  );
}
