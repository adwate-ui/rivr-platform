import { t } from '@rivr/i18n';

export interface SkeletonProps {
  /** How many list rows stand in under the heading blocks: three unless given. */
  rows?: number;
}

/**
 * A screen's first load (decision 0320): faint blocks where its heading, its action and its rows will be, never the word
 * "Loading". A screen reader hears that it is loading.
 */
export function Skeleton({ rows = 3 }: SkeletonProps) {
  return (
    <div role="status" aria-busy="true" className="flex flex-col gap-3 py-6">
      <span className="sr-only">{t('common.loading')}</span>
      <span aria-hidden="true" className="h-4 w-2/5 rounded-sm bg-skeleton" />
      <span aria-hidden="true" className="h-touch w-4/5 rounded-sm bg-skeleton" />
      <span aria-hidden="true" className="mt-3 mb-10 h-round w-full rounded-md bg-skeleton" />
      {Array.from({ length: rows }, (_, index) => (
        <span key={index} aria-hidden="true" data-skeleton-row="" className="h-tile w-full rounded-md bg-skeleton-faint" />
      ))}
    </div>
  );
}
