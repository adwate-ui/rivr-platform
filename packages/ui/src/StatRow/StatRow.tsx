import { cx } from '../internal/classes.ts';

/** One stat: its name above, its figure below. */
export interface Stat {
  readonly label: string;
  readonly value: string;
}

export interface StatRowProps {
  /** Two or three stats side by side. */
  stats: readonly Stat[];
  /** `display`, the figure in the display face at 32 (Sessions); `medium`, the text face at 20 (the join sheet). */
  size?: 'display' | 'medium';
}

const COLUMNS: Record<number, string> = { 2: 'grid-cols-2', 3: 'grid-cols-3' };

/**
 * Stats side by side between two hairlines (decision 0320), each after the first ruled off at its left: "This month" and
 * "Hours played" on Sessions; "Seats open", "Waiting" and "Call time" in the join sheet.
 */
export function StatRow({ stats, size = 'display' }: StatRowProps) {
  return (
    <dl className={cx('grid border-y border-hairline', COLUMNS[stats.length] ?? 'grid-cols-3')}>
      {stats.map((stat, index) => (
        <div key={stat.label} className={cx('flex flex-col gap-1 py-4', index > 0 && 'border-l border-hairline pl-4')}>
          <dt className="font-text text-12 text-content-muted">{stat.label}</dt>
          <dd className={size === 'display' ? 'font-display text-32 leading-tight' : 'font-text text-20 font-medium'}>{stat.value}</dd>
        </div>
      ))}
    </dl>
  );
}
