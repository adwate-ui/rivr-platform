import { HIDDEN_TV_MODES, type TvMode } from '@rivr/contracts';
import { useMyTvScreen, useTvSignals } from '@rivr/db';
import { t } from '@rivr/i18n';
import { Heading, Stack, Text, TvBoardProgress } from '@rivr/ui';
import { useCallback, useEffect, useState } from 'react';
import { CallTimeMode } from './CallTimeMode.tsx';
import { LeagueMode } from './LeagueMode.tsx';
import { PromotionsMode, SLIDE_MS } from './PromotionsMode.tsx';
import { RewardsMode } from './RewardsMode.tsx';
import { SocialWallMode } from './SocialWallMode.tsx';
import { SpinMode } from './SpinMode.tsx';
import { TournamentClockMode } from './TournamentClockMode.tsx';
import { WaitlistMode } from './WaitlistMode.tsx';

// In a rotation, each board shows for half a minute; the promotions show one after another, then the next board.
// The bar along the stage's foot fills over the half minute, so a board that is not changing reads as live (#628).
const BOARD_MS = 30_000;
// The promotions turn every 12 seconds, so there the bar fills over each slide.
const progressFor = (mode: TvMode) => (mode === 'promotions' ? SLIDE_MS : BOARD_MS);

/**
 * The boards a TV shows: its main one, then those it turns to (decision 0163). A main mode the club hid (#628: the
 * jackpot, as the TV shows no rupee) shows as the waitlist board, and a hidden one in the rotation is passed over.
 */
export function boardsFor(mode: TvMode, rotation: readonly TvMode[]): TvMode[] {
  const shown = (board: TvMode) => !HIDDEN_TV_MODES.includes(board);
  return [shown(mode) ? mode : 'waitlist', ...rotation.filter(shown)];
}

interface BoardProps {
  mode: TvMode;
  name: string;
  /** In a rotation: the promotions call it once each has shown. */
  onDone?: (() => void) | undefined;
}

/** One board. The waitlist board is built (#65, the jackpot hidden by #628), the promotions (#86), the call-time board (decision 0163), the rewards ticker and League leaderboard (#148), the tournament clock (#119), the spin wheel (#150) and the social wall (#158); the other modes show their name under the TV's until they are. */
function Board({ mode, name, onDone }: BoardProps) {
  if (mode === 'waitlist') return <WaitlistMode />;
  if (mode === 'call_time') return <CallTimeMode />;
  if (mode === 'promotions') return <PromotionsMode onDone={onDone} />;
  if (mode === 'rewards') return <RewardsMode />;
  if (mode === 'league') return <LeagueMode />;
  if (mode === 'tournament_clock') return <TournamentClockMode name={name} />;
  if (mode === 'spin_wheel') return <SpinMode />;
  if (mode === 'social_wall') return <SocialWallMode />;
  return (
    <Stack gap={4}>
      <Heading level={1} variant="display">{t(`tv.modes.${mode}`)}</Heading>
      <Text variant="tvBody" tone="muted">{name}</Text>
    </Stack>
  );
}

/** The TV's main board, then each board it turns to (decision 0163), round and round, each with its progress from empty. */
function Rotation({ boards, name }: { boards: readonly TvMode[]; name: string }) {
  const [turn, setTurn] = useState(0);
  const next = useCallback(() => setTurn((current) => current + 1), []);
  const mode = boards[turn % boards.length] ?? 'waitlist';
  useEffect(() => {
    if (mode === 'promotions') return undefined;
    const timer = setTimeout(next, BOARD_MS);
    return () => clearTimeout(timer);
  }, [mode, turn, next]);
  return (
    <>
      <Board key={turn} mode={mode} name={name} onDone={next} />
      <TvBoardProgress key={`progress-${turn}`} durationMs={progressFor(mode)} />
    </>
  );
}

/** The paired TV's boards, live: one Realtime channel for all of them, however they turn (decision 0163). */
function Boards({ venueId, mode, rotation, name }: { venueId: string; mode: TvMode; rotation: readonly TvMode[]; name: string }) {
  useTvSignals(venueId);
  const boards = boardsFor(mode, rotation);
  if (boards.length === 1) {
    return (
      <>
        <Board mode={boards[0] ?? 'waitlist'} name={name} />
        <TvBoardProgress durationMs={progressFor(boards[0] ?? 'waitlist')} />
      </>
    );
  }
  return <Rotation key={boards.join()} boards={boards} name={name} />;
}

/**
 * A paired TV: the mode the console gave it, and the boards it turns to in between (decision 0163). It
 * asks again every ten seconds, so a new mode shows without a reload, and an unpaired TV signs itself
 * out and shows a new code.
 */
export function ModeScreen() {
  const screen = useMyTvScreen();
  if (screen.data === undefined) {
    return <Text variant="tvBody" tone="muted">{t(screen.isError ? 'display.screen.unavailable' : 'common.loading')}</Text>;
  }
  // Null while an unpaired TV signs itself out; the code follows.
  if (screen.data === null) return null;
  return <Boards venueId={screen.data.venueId} mode={screen.data.mode} rotation={screen.data.rotation} name={screen.data.name} />;
}
