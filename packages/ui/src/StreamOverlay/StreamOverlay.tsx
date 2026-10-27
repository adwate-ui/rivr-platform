import type { ReactNode } from 'react';
import { Heading } from '../Heading/Heading.tsx';
import { TV_HEIGHT, TV_WIDTH } from '../internal/displayStage.tsx';
import { useFitScale } from '../internal/fit.ts';
import { Text } from '../Text/Text.tsx';
import type { TvTournamentClockProps } from '../TvTournamentClock/TvTournamentClock.tsx';
import { Wordmark } from '../Wordmark/Wordmark.tsx';

/** What the stream's clock shows: the TV's clock without the payouts. */
export type StreamOverlayClock = Omit<TvTournamentClockProps, 'payoutsLabel' | 'payouts' | 'noPayoutsText'>;

export interface StreamOverlayProps {
  /** The clock; absent while there is nothing to show, and then the stream sees nothing at all. */
  clock?: StreamOverlayClock | undefined;
  /** Why there is no clock, for a screen reader only, so none of it reaches the stream: "No tournament is running." */
  statusText?: string | undefined;
  /** Above everything: the kill-switch banner while the venue is frozen. */
  banner?: ReactNode;
}

function ClockBar({ clock }: { clock: StreamOverlayClock }) {
  return (
    <section aria-label={clock.name} className="flex flex-col gap-6 rounded-md border border-hairline bg-surface px-12 py-8">
      <div className="flex items-end justify-between gap-12">
        <div className="flex min-w-0 flex-col">
          <Text variant="tvLabel" tone="muted" truncate>{clock.name}</Text>
          <Heading level={1} variant="display">{clock.level}</Heading>
        </div>
        <div className="flex items-baseline gap-6">
          <span role="timer" className="font-text text-96 font-medium leading-tight tabular-nums">{clock.remaining}</span>
          {clock.status === undefined ? null : <Text variant="tvBody" tone="muted">{clock.status}</Text>}
        </div>
        <div className="flex flex-col items-end">
          <div className="flex items-baseline gap-6 whitespace-nowrap">
            <span className="font-text text-56 font-medium leading-tight tabular-nums">{clock.blinds}</span>
            {clock.ante === undefined ? null : <span className="font-text text-36 leading-tight tabular-nums">{clock.ante}</span>}
          </div>
          {clock.next === undefined ? null : <Text variant="tvLabel" tone="muted">{clock.next}</Text>}
        </div>
      </div>
      <div className="flex items-center justify-between gap-12 border-t border-hairline pt-6">
        <Wordmark size="md" />
        <dl className="flex gap-x-16">
          {clock.stats.map((stat) => (
            <div key={stat.label} className="flex items-baseline gap-4">
              <dt><Text variant="tvLabel" tone="muted">{stat.label}</Text></dt>
              <dd className="font-text text-44 font-medium leading-tight tabular-nums">{stat.value}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}

/**
 * The final-table stream's overlay (#125), an OBS browser source: the TV's 1920 by 1080 stage on a
 * transparent page, the tournament clock in one bar across its foot, over the video. With no clock it
 * draws nothing, so nothing but the clock ever reaches the stream. It holds no state: the app passes
 * what to show, already held back by the hole-card delay.
 */
export function StreamOverlay({ clock, statusText, banner }: StreamOverlayProps) {
  const scale = useFitScale(TV_WIDTH, TV_HEIGHT);
  return (
    <div data-stream-overlay className="flex h-dvh w-full items-center justify-center overflow-hidden">
      <div
        className="flex shrink-0 flex-col justify-between px-16 py-12 text-content"
        style={{ width: TV_WIDTH, height: TV_HEIGHT, transform: `scale(${scale})` }}
      >
        <div>{banner}</div>
        {clock === undefined ? <p role="status" className="sr-only">{statusText}</p> : <ClockBar clock={clock} />}
      </div>
    </div>
  );
}
