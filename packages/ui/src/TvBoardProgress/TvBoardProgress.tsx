export interface TvBoardProgressProps {
  /** How long the board shows, in milliseconds: the bar fills over it, then starts again. */
  durationMs: number;
}

/**
 * A thin bar along the foot of the TV's stage that fills over a board's time and then starts again (#628), so a
 * board that is not changing still reads as live. The TV mounts it again with each board, which starts it from
 * empty. It says nothing a viewer needs, so screen readers skip it; with reduced motion it stands full.
 */
export function TvBoardProgress({ durationMs }: TvBoardProgressProps) {
  return (
    <div aria-hidden="true" className="absolute inset-x-0 bottom-0 h-2 bg-hairline">
      <div data-board-progress className="h-full w-full origin-left bg-accent" style={{ animationDuration: `${durationMs}ms` }} />
    </div>
  );
}
