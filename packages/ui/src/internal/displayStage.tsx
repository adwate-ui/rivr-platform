import { tokens } from '@rivr/tokens';
import type { ReactNode } from 'react';
import { Wordmark } from '../Wordmark/Wordmark.tsx';

export const { width: TV_WIDTH, height: TV_HEIGHT } = tokens.viewport.tv;

interface DisplayStageProps {
  children: ReactNode;
  corner?: ReactNode;
  scale: number;
  origin: 'center' | 'top left';
  /** `main` on the TV; a `div` in a preview, which sits inside the console's own main. */
  body: 'main' | 'div';
}

/**
 * The TV's fixed 1920 by 1080 stage: the wordmark, the corner opposite, and the mode beneath, drawn at
 * `scale` from `origin`. DisplayShell fits it to the TV; DisplayPreview to a box on the console. A board's
 * progress (TvBoardProgress) sits along its foot.
 */
export function DisplayStage({ children, corner, scale, origin, body: Body }: DisplayStageProps) {
  return (
    <div
      className="relative flex shrink-0 flex-col gap-12 bg-surface px-24 py-16 text-content"
      style={{ width: TV_WIDTH, height: TV_HEIGHT, transform: `scale(${scale})`, transformOrigin: origin }}
    >
      <header className="flex items-start justify-between">
        <Wordmark size="lg" withTagline />
        {corner}
      </header>
      <Body className="flex min-h-0 flex-1 flex-col">{children}</Body>
    </div>
  );
}
