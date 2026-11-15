import type { TvMode } from '@rivr/contracts';
import { useMyTvScreen, useTvSignals, type TvBoardTurn } from '@rivr/db';
import { StaleNotice, TvBoardProgress } from '@rivr/ui';
import { useCallback, useEffect, useMemo, useState, type ReactElement } from 'react';
import { CallTimeMode } from './CallTimeMode.tsx';
import { HighHandMode } from './HighHandMode.tsx';
import { LeaderboardMode } from './LeaderboardMode.tsx';
import { PromotionsMode } from './PromotionsMode.tsx';
import { WaitlistMode } from './WaitlistMode.tsx';
import { BoardStatus } from './BoardStatus.tsx';

// A board with no turn of its own to read still shows: the waitlist, for half a minute.
const WAITLIST: TvBoardTurn = { mode: 'waitlist', seconds: 30 };

/** A board's time on the screen, in milliseconds: the seconds Settings, TVs, Rotation gives it; for the promotions, each slide's. */
export const turnMs = (board: TvBoardTurn) => board.seconds * 1_000;

interface BoardProps {
  board: TvBoardTurn;
  /** In a rotation: the promotions call it once each has shown. */
  onDone?: (() => void) | undefined;
  /** In a rotation, except the first board: a board with nothing to show calls it to pass on (D-03). */
  onEmpty?: (() => void) | undefined;
}

// The five boards (redesign RD-28), and nothing else.
const BOARDS: Readonly<Record<TvMode, (props: BoardProps) => ReactElement>> = {
  waitlist: () => <WaitlistMode />,
  call_time: () => <CallTimeMode />,
  promotions: ({ board, onDone }) => <PromotionsMode slideMs={turnMs(board)} onDone={onDone} />,
  leaderboard: ({ onEmpty }) => <LeaderboardMode onEmpty={onEmpty} />,
  high_hand: ({ onEmpty }) => <HighHandMode onEmpty={onEmpty} />,
};

/** One board: the waitlist (#65), call time (decision 0163), the promotions (#86), the hours leaderboard (decision 0581) or the high hand bonus. */
function Board(props: BoardProps) {
  return BOARDS[props.board.mode](props);
}

/** The TV's boards in turn (decision 0163), round and round, each for its own seconds, with its progress from empty. */
function Rotation({ boards }: { boards: readonly TvBoardTurn[] }) {
  const [turn, setTurn] = useState(0);
  const next = useCallback(() => setTurn((current) => current + 1), []);
  // Once a turn whoever asks: an empty board and its effect run twice in development, and must not skip two boards (D-03).
  const done = useMemo(() => () => setTurn((current) => (current === turn ? current + 1 : current)), [turn]);
  const board = boards[turn % boards.length] ?? WAITLIST;
  useEffect(() => {
    // The promotions hand on themselves, once each has shown.
    if (board.mode === 'promotions') return undefined;
    const timer = setTimeout(next, turnMs(board));
    return () => clearTimeout(timer);
  }, [board, turn, next]);
  return (
    <>
      <Board key={turn} board={board} onDone={done} onEmpty={turn % boards.length === 0 ? undefined : done} />
      <TvBoardProgress key={`progress-${turn}`} durationMs={turnMs(board)} />
    </>
  );
}

/** The paired TV's boards, live: one Realtime channel for all of them, however they turn (decision 0163). */
function Boards({ venueId, boards }: { venueId: string; boards: readonly TvBoardTurn[] }) {
  useTvSignals(venueId);
  const [first = WAITLIST, ...rest] = boards;
  if (rest.length === 0) {
    return (
      <>
        <Board board={first} />
        <TvBoardProgress durationMs={turnMs(first)} />
      </>
    );
  }
  return <Rotation key={boards.map((board) => `${board.mode}:${String(board.seconds)}`).join()} boards={boards} />;
}

/**
 * A paired TV: the boards the console gave it, less any switched off in Settings, each for the seconds set there (redesign
 * RD-28). It asks again every ten seconds, so a change shows without a reload, and an unpaired TV signs itself out and
 * shows a new code. When that ask fails, as every read does in a network drop, the boards keep what they last had and a
 * quiet line says since when (F3-24); no one can press anything on a TV.
 */
export function ModeScreen() {
  const screen = useMyTvScreen();
  if (screen.data === undefined) {
    return <BoardStatus isError={screen.isError} />;
  }
  // Null while an unpaired TV signs itself out; the code follows.
  if (screen.data === null) return null;
  return (
    <>
      <Boards venueId={screen.data.venueId} boards={screen.data.boards} />
      {screen.isError ? <StaleNotice since={new Date(screen.dataUpdatedAt)} variant="tv" /> : null}
    </>
  );
}
