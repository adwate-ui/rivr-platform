import { formatTime } from '@rivr/i18n';
import { useContext, type ReactNode } from 'react';
import { Heading } from '../Heading/Heading.tsx';
import { TvStageFrameContext } from '../internal/displayStage.tsx';
import { Wordmark } from '../Wordmark/Wordmark.tsx';

export interface TvStageProps {
  /** The board's title, beside the wordmark: "Waitlist". Left out on a screen with no title of its own. */
  title?: string | undefined;
  /** The title's heading level: 1 on the TV, 2 where the stage is a preview inside another screen. */
  level?: 1 | 2 | undefined;
  /** The board, between the header and the foot. */
  children: ReactNode;
}

/**
 * What every TV board stands in (redesign RD-28): one header row, the wordmark, the board's title beside it in the display
 * face and the club's time opposite; the board; and along the foot a gold rule with the club's notice under it in spaced
 * capitals, two lines at most. The clock and the notice are the shell's (DisplayShell): with no notice there is no rule
 * and no line. Every board in @rivr/ui draws it for itself; a screen with no board of its own (the pairing code, a board
 * still loading) is wrapped in it by the app.
 */
export function TvStage({ title, level = 1, children }: TvStageProps) {
  const { clockAt, notice } = useContext(TvStageFrameContext);
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-8">
      <header className="flex items-center gap-12">
        <Wordmark size="lg" />
        <div className="min-w-0 flex-1">
          {title === undefined ? null : <Heading level={level} variant="tvTitle">{title}</Heading>}
        </div>
        {clockAt === undefined ? null : (
          <time dateTime={clockAt.toISOString()} className="shrink-0 font-text text-56 leading-tight tabular-nums text-content-muted">{formatTime(clockAt)}</time>
        )}
      </header>
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">{children}</div>
      {notice === undefined ? null : (
        <footer className="border-t border-accent pt-5">
          <p className="line-clamp-2 font-text text-24 font-medium uppercase leading-snug tracking-tv text-content-muted">{notice}</p>
        </footer>
      )}
    </div>
  );
}
