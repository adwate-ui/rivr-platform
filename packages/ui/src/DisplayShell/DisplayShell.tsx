import type { ReactNode } from 'react';
import { DisplayStage, TV_HEIGHT, TV_WIDTH } from '../internal/displayStage.tsx';
import { useFitScale } from '../internal/fit.ts';

export interface DisplayShellProps {
  /** The TV mode: waitlist board, jackpot, tournament clock, promotions. */
  children: ReactNode;
  /** Top right, opposite the wordmark: the clock. */
  corner?: ReactNode;
}

/**
 * The TV frame: every TV mode is laid out on a fixed 1920 by 1080 stage, scaled to fit the
 * screen it runs on, under the wordmark. It holds no state of its own; the scale follows the window.
 */
export function DisplayShell({ children, corner }: DisplayShellProps) {
  const scale = useFitScale(TV_WIDTH, TV_HEIGHT);
  return (
    <div className="flex h-dvh w-full items-center justify-center overflow-hidden bg-surface">
      <DisplayStage corner={corner} scale={scale} origin="center" body="main">{children}</DisplayStage>
    </div>
  );
}
