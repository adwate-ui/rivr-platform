import { useControlState, useIsPublicVenue, useMyTvScreen, useTvSignals, useTvTournamentClock, type MyTvScreen } from '@rivr/db';
import { formatNumber, t } from '@rivr/i18n';
import { DisplayShell, Heading, KillSwitchBanner, Stack, StreamOverlay, Text } from '@rivr/ui';
import { useDelayedTournament, type DelayedTournament } from '../hooks/useDelayedTournament.ts';
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

/** What is wrong with the overlay's setup, on the TV's own green, so it is seen in OBS's preview before the stream starts. */
function SetupPage({ message }: { message: string }) {
  const { isVenueFrozen } = useControlState();
  return (
    <DisplayShell>
      <Stack gap={8}>
        {isVenueFrozen ? <KillSwitchBanner audience="member" /> : null}
        <Stack gap={4}>
          <Heading level={1} variant="display">{t('display.overlay.title')}</Heading>
          <Text variant="tvBody">{message}</Text>
        </Stack>
      </Stack>
    </DisplayShell>
  );
}

/**
 * What is wrong with a paired overlay's setup, or null: at the practice venue, or given another mode than the
 * tournament clock (#559), said at once, listening on so the clock shows as soon as it is chosen.
 */
function setupOf(isPublic: boolean | undefined, screen: MyTvScreen | null | undefined) {
  if (isPublic === false) return <SetupPage message={t('display.overlay.practice')} />;
  if (!screen || screen.mode === 'tournament_clock') return null;
  return <><Signals venueId={screen.venueId} /><SetupPage message={t('display.overlay.notClock')} /></>;
}

/** Why the stream shows no clock, for a screen reader only; undefined while it shows one. */
function statusOf(isRead: boolean, isError: boolean, shown: DelayedTournament | undefined, delaySeconds: number): string | undefined {
  if (!isRead) return t(isError ? 'display.screen.unavailable' : 'common.loading');
  if (shown === undefined) return t('display.overlay.waiting', { seconds: formatNumber(delaySeconds) });
  return shown.tournament === null ? t('tv.tournamentClock.none') : undefined;
}

/**
 * The clock as it was `delaySeconds` ago; with nothing to show, why, for a screen reader only. Paired
 * at the practice venue, which never reaches anyone outside the club, or given another mode than the
 * tournament clock (#559), it shows no clock and says so.
 */
function DelayedClock({ delaySeconds }: { delaySeconds: number }) {
  const screen = useMyTvScreen();
  const isPublic = useIsPublicVenue(screen.data?.venueId);
  const clock = useTvTournamentClock();
  const { isVenueFrozen } = useControlState();
  const shown = useDelayedTournament(clock.data, clock.dataUpdatedAt, delaySeconds);
  const setup = setupOf(isPublic, screen.data);
  if (setup !== null) return setup;
  const statusText = statusOf(clock.data !== undefined && isPublic !== undefined, clock.isError, shown, delaySeconds);
  return (
    <>
      {screen.data ? <Signals venueId={screen.data.venueId} /> : null}
      <StreamOverlay
        banner={isVenueFrozen ? <KillSwitchBanner audience="member" /> : null}
        // The TV clock's props; the overlay leaves out its payouts.
        clock={isPublic === true && shown?.tournament ? toClockProps(shown.tournament, shown.elapsedSeconds) : undefined}
        statusText={statusText}
      />
    </>
  );
}

/**
 * The final-table stream's overlay for OBS (#125, decision 0256): the TV's tournament clock on a
 * transparent page, held back by the hole-card delay in its address. The overlay is paired as a TV and
 * given the tournament clock on the console. With no delay in the address it says how to add one.
 */
export function StreamOverlayScreen({ delaySeconds }: { delaySeconds: number | undefined }) {
  if (delaySeconds === undefined) return <SetupPage message={t('display.overlay.noDelay')} />;
  return <DelayedClock delaySeconds={delaySeconds} />;
}
