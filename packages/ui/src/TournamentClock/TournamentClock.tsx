import type { ReactNode } from 'react';
import { Text } from '../Text/Text.tsx';

/** A figure under the clock: its label ("Entries") and its value as shown ("58", "₹5,22,000"). */
export interface TournamentClockStat {
  label: string;
  value: string;
}

export interface TournamentClockProps {
  /** The tournament and where its clock stands: "RIVR Sunday · level 7". */
  title: string;
  /** The stage's time left, as the clock shows it: "11:34". */
  remaining: string;
  /** The blinds and ante in chips: "400/800 ante 800"; "Break" on a break. */
  blinds: string;
  /** The next level: "Next 500/1,000 ante 1,000"; absent on the last level. */
  next?: string | undefined;
  /** Beside the clock when it is not running: "Paused", "Not started". */
  status?: string | undefined;
  /** The floor's controls under the clock: Start, Pause, Previous level, Next level. */
  actions?: ReactNode;
  /** Entries, players left, the average stack, the pool, in that order; none shows no row. */
  stats?: readonly TournamentClockStat[];
}

function Stats({ stats }: { stats: readonly TournamentClockStat[] }) {
  return (
    <dl className="flex flex-wrap gap-x-12 gap-y-4 border-y border-hairline py-4">
      {stats.map((stat) => (
        <div key={stat.label} className="flex flex-col gap-1">
          <dt><Text variant="small" tone="muted">{stat.label}</Text></dt>
          <dd className="font-text text-20 font-medium leading-tight tabular-nums text-content">{stat.value}</dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * A tournament's clock on the console (#119), as in the prototype: the tournament and its level, the
 * stage's time left as the largest figure beside the blinds, the next level, the floor's controls, and
 * the figures under them. It holds no state: the screen passes what to show and ticks it.
 */
export function TournamentClock({ title, remaining, blinds, next, status, actions, stats = [] }: TournamentClockProps) {
  return (
    <section aria-label={title} className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Text variant="small" tone="muted">{title}</Text>
        <div className="flex flex-wrap items-baseline gap-x-8 gap-y-2">
          <span role="timer" className="font-text text-56 font-medium leading-tight tabular-nums text-content">{remaining}</span>
          <span className="font-text text-28 leading-tight tabular-nums text-content">{blinds}</span>
          {status === undefined ? null : <Text tone="muted">{status}</Text>}
        </div>
        {next === undefined ? null : <Text variant="small" tone="muted">{next}</Text>}
      </div>
      {actions === undefined ? null : <div className="flex flex-wrap items-center gap-4">{actions}</div>}
      {stats.length === 0 ? null : <Stats stats={stats} />}
    </section>
  );
}
