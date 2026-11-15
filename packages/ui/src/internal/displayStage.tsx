import { tokens } from '@rivr/tokens';
import { createContext, useMemo, type ReactNode } from 'react';

export const { width: TV_WIDTH, height: TV_HEIGHT } = tokens.viewport.tv;

/**
 * The room a board has on the stage, in px at 1920 by 1080: the stage's 1080, less its padding (48 above and below), the
 * header (97, the title's line), the gaps round the board (32 each) and the foot with a notice of two lines (84). A board
 * counts its rows against it, so a full one says "+N more" rather than run over the notice.
 */
export const TV_BOARD_ROOM = 739;
/** The width a board has: the stage's 1920 less its padding, 80 each side. */
export const TV_BOARD_WIDTH = 1760;

/** What the stage holds for every board on it: the club's time now, and the notice along the foot. */
export interface TvStageFrame {
  /** The moment the clock shows, in IST: left out, the stage has no clock. */
  clockAt?: Date | undefined;
  /** The club's notice: left out, the stage has no foot. */
  notice?: string | undefined;
}

export const TvStageFrameContext = createContext<TvStageFrame>({});

interface DisplayStageProps extends TvStageFrame {
  children: ReactNode;
  scale: number;
  origin: 'center' | 'top left';
  /** `main` on the TV; a `div` in a preview, which sits inside the console's own main. */
  body: 'main' | 'div';
}

/**
 * The TV's fixed 1920 by 1080 stage, drawn at `scale` from `origin`. DisplayShell fits it to the TV; DisplayPreview to a
 * box on the console. What is on it draws its own header and foot with TvStage, which reads the clock and the notice
 * from here. A board's progress (TvBoardProgress) sits along the stage's foot.
 */
export function DisplayStage({ children, clockAt, notice, scale, origin, body: Body }: DisplayStageProps) {
  const frame = useMemo(() => ({ clockAt, notice }), [clockAt, notice]);
  return (
    <div
      className="relative flex shrink-0 flex-col bg-surface px-20 py-12 text-content"
      style={{ width: TV_WIDTH, height: TV_HEIGHT, transform: `scale(${scale})`, transformOrigin: origin }}
    >
      <TvStageFrameContext.Provider value={frame}>
        <Body className="flex min-h-0 flex-1 flex-col">{children}</Body>
      </TvStageFrameContext.Provider>
    </div>
  );
}
