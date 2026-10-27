import { useControlState, useMyTvScreen, useTvSignals, useTvTournamentClock } from '@rivr/db';
import { formatNumber, t } from '@rivr/i18n';
import { DisplayShell, Heading, KillSwitchBanner, Stack, StreamOverlay, Text } from '@rivr/ui';
import { useDelayedTournament } from '../hooks/useDelayedTournament.ts';
import { toClockProps } from './TournamentClockMode.tsx';

// A delay is whole seconds, up to an hour.
const MOST_DELAY_SECONDS = 3600;

/** The hole-card delay from the overlay's address (`?delay=900`): whole seconds up to an hour, or undefined for none or anything else. */
export function overlayDelay(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= MOST_DELAY_SECONDS ? value : undefined;
}

/** Listens on the venue's TV topic, so a change reaches the overlay within seconds, as it does a TV. */
function Signals({ venueId }: { venueId: string }) {
  useTvSignals(venueId);
  return null;
}

/** The clock as it was `delaySeconds` ago; with nothing to show, why, for a screen reader only. */
function DelayedClock({ delaySeconds }: { delaySeconds: number }) {
  const screen = useMyTvScreen();
  const clock = useTvTournamentClock();
  const { isVenueFrozen } = useControlState();
  const shown = useDelayedTournament(clock.data, clock.dataUpdatedAt, delaySeconds);
  let statusText: string | undefined;
  if (clock.data === undefined) statusText = t(clock.isError ? 'display.screen.unavailable' : 'common.loading');
  else if (shown === undefined) statusText = t('display.overlay.waiting', { seconds: formatNumber(delaySeconds) });
  else if (shown.tournament === null) statusText = t('tv.tournamentClock.none');
  return (
    <>
      {screen.data ? <Signals venueId={screen.data.venueId} /> : null}
      <StreamOverlay
        banner={isVenueFrozen ? <KillSwitchBanner audience="member" /> : null}
        // The TV clock's props; the overlay leaves out its payouts.
        clock={shown?.tournament ? toClockProps(shown.tournament, shown.elapsedSeconds) : undefined}
        statusText={statusText}
      />
    </>
  );
}

/**
 * The final-table stream's overlay for OBS (#125, decision 0256): the TV's tournament clock on a
 * transparent page, held back by the hole-card delay in its address. The overlay is paired as a TV and
 * given the tournament clock on the console. With no delay in the address it says how to add one, on
 * the TV's own green, so it is seen in OBS before the stream starts.
 */
export function StreamOverlayScreen({ delaySeconds }: { delaySeconds: number | undefined }) {
  if (delaySeconds !== undefined) return <DelayedClock delaySeconds={delaySeconds} />;
  return (
    <DisplayShell>
      <Stack gap={4}>
        <Heading level={1} variant="display">{t('display.overlay.title')}</Heading>
        <Text variant="tvBody">{t('display.overlay.noDelay')}</Text>
      </Stack>
    </DisplayShell>
  );
}
