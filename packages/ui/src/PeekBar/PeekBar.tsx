export interface PeekBarProps {
  /** "All tables". */
  title: string;
  /** "4 running · 2 tournaments". */
  aside: string;
  /** Opens the sheet it peeks at. */
  onOpen: () => void;
}

/**
 * The top of a sheet left showing above the tab bar (decision 0320): on Tonight, while the member waits or plays, all the
 * tables are one tap away. The grabber, the title and what is under it.
 */
export function PeekBar({ title, aside, onOpen }: PeekBarProps) {
  return (
    <button type="button" aria-haspopup="dialog" onClick={onOpen}
      className="flex w-full flex-col gap-3 rounded-t-sheet border-t border-hairline bg-raised px-5 pt-3 pb-4 text-content">
      <span aria-hidden="true" className="h-1 w-grabber self-center rounded-full bg-cream-faint" />
      <span className="flex w-full items-center justify-between gap-3">
        <span className="font-text text-16 font-medium">{title}</span>
        <span className="font-text text-13 text-content-muted">{aside}</span>
      </span>
    </button>
  );
}
