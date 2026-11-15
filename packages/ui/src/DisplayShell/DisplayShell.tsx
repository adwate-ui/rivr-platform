import type { ReactNode } from 'react';
import { DisplayStage, TV_HEIGHT, TV_WIDTH } from '../internal/displayStage.tsx';
import { useFitScale } from '../internal/fit.ts';

export interface DisplayShellProps {
  /** What the TV shows: a board, or a screen wrapped in TvStage. */
  children: ReactNode;
  /** The moment the clock in the header shows, in IST; left out, no clock. */
  clockAt?: Date | undefined;
  /** The club's notice along the foot of every board; left out, no rule and no line. */
  notice?: string | undefined;
}

/**
 * The TV frame: every TV board is laid out on a fixed 1920 by 1080 stage, scaled to fit the screen it runs on. It holds
 * the clock and the notice for the boards' header and foot (TvStage), and no state of its own; the scale follows the window.
 */
export function DisplayShell({ children, clockAt, notice }: DisplayShellProps) {
  const scale = useFitScale(TV_WIDTH, TV_HEIGHT);
  return (
    <div className="flex h-dvh w-full items-center justify-center overflow-hidden bg-surface">
      <DisplayStage clockAt={clockAt} notice={notice} scale={scale} origin="center" body="main">{children}</DisplayStage>
    </div>
  );
}
