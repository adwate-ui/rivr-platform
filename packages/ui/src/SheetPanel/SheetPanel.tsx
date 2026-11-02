import type { ReactNode } from 'react';

export interface SheetPanelProps {
  /** "All tables". */
  title: string;
  /** A muted word at the title's right: "4 running". */
  aside?: string | undefined;
  children: ReactNode;
}

/**
 * A sheet lying open in the page (decision 0320): Tonight's tables while the member browses. The raised panel with its
 * 16 px top corners, gold hairline and grabber, then its title and what is in it, filling the rest of the screen.
 */
export function SheetPanel({ title, aside, children }: SheetPanelProps) {
  return (
    <section aria-label={title} className="flex min-h-dvh flex-col rounded-t-sheet border-t border-hairline bg-raised px-5 pt-3 pb-8 text-content">
      <span aria-hidden="true" className="h-1 w-grabber self-center rounded-full bg-cream-faint" />
      <div className="flex items-baseline justify-between gap-3 pt-4 pb-2">
        <h2 className="font-text text-18 font-medium">{title}</h2>
        {aside ? <span className="font-text text-13 text-content-muted">{aside}</span> : null}
      </div>
      {children}
    </section>
  );
}
