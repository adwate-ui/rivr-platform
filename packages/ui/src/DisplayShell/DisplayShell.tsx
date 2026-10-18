import { tokens } from '@rivr/tokens';
import type { ReactNode } from 'react';
import { useFitScale } from '../internal/fit.ts';
import { Wordmark } from '../Wordmark/Wordmark.tsx';

const { width: TV_WIDTH, height: TV_HEIGHT } = tokens.viewport.tv;

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
      <div
        className="flex shrink-0 flex-col gap-12 bg-surface px-24 py-16 text-content"
        style={{ width: TV_WIDTH, height: TV_HEIGHT, transform: `scale(${scale})` }}
      >
        <header className="flex items-start justify-between">
          <Wordmark size="lg" withTagline />
          {corner}
        </header>
        <main className="flex min-h-0 flex-1 flex-col">{children}</main>
      </div>
    </div>
  );
}
