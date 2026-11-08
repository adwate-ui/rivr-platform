import { t } from '@rivr/i18n';

export interface SkeletonProps {
  /** How many rows, or tiles, stand in: three unless given. */
  rows?: number;
  /**
   * `screen`, the player app's first load: its heading, its action and its rows (decision 0320). The console's (console v3):
   * `rows`, a list or table's 44 px rows under a heading and a line; `tiles`, the live floor's table tiles.
   */
  look?: 'screen' | 'rows' | 'tiles';
}

/** The player app's screen: the heading, the action, then rows. */
function ScreenBlocks({ rows }: { rows: number }) {
  return (
    <>
      <span aria-hidden="true" className="h-4 w-2/5 rounded-sm bg-skeleton" />
      <span aria-hidden="true" className="h-touch w-4/5 rounded-sm bg-skeleton" />
      <span aria-hidden="true" className="mt-3 mb-10 h-round w-full rounded-md bg-skeleton" />
      {Array.from({ length: rows }, (_, index) => (
        <span key={index} aria-hidden="true" data-skeleton-row="" className="h-tile w-full rounded-md bg-skeleton-faint" />
      ))}
    </>
  );
}

/** The console's list: a heading and a line, then rows; or its floor's tiles, side by side as wide as the screen allows. */
function ConsoleBlocks({ rows, look }: { rows: number; look: 'rows' | 'tiles' }) {
  const blocks = Array.from({ length: rows }, (_, index) => index);
  return (
    <>
      <span aria-hidden="true" className="h-6 w-1/4 rounded-md bg-skeleton" />
      <span aria-hidden="true" className="mb-3 h-3 w-1/2 rounded-md bg-skeleton-faint" />
      {look === 'rows' ? (
        blocks.map((index) => <span key={index} aria-hidden="true" data-skeleton-row="" className="h-touch w-full rounded-md bg-skeleton-faint" />)
      ) : (
        <span aria-hidden="true" className="grid gap-3 medium:grid-cols-2 wide:grid-cols-3">
          {blocks.map((index) => <span key={index} data-skeleton-row="" className="h-24 rounded-lg bg-skeleton-faint" />)}
        </span>
      )}
    </>
  );
}

/**
 * A first load (decision 0320, console v3): faint blocks where the content will be, never the word "Loading". A screen
 * reader hears that it is loading.
 */
export function Skeleton({ rows = 3, look = 'screen' }: SkeletonProps) {
  return (
    // No aria-busy on the status itself, which could keep its Loading from being heard (F-177).
    <div role="status" className="flex flex-col gap-3 py-6">
      <span className="sr-only">{t('common.loading')}</span>
      {look === 'screen' ? <ScreenBlocks rows={rows} /> : <ConsoleBlocks rows={rows} look={look} />}
    </div>
  );
}
