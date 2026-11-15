import { formatNumber, t } from '@rivr/i18n';
import { cx } from '../internal/classes.ts';

/** A stretch of pages left out between two shown. */
const GAP = 'gap';

/**
 * The pages to offer of `count`: the first, the last, and the one shown with a neighbour either side (three at either
 * end), with a gap where two or more are left out: `1 2 3 … 193`, `1 … 49 50 51 … 193`.
 */
export function pagesShown(page: number, count: number): readonly (number | typeof GAP)[] {
  const start = Math.min(Math.max(page - 1, 1), Math.max(count - 2, 1));
  const numbers = [...new Set([1, start, start + 1, start + 2, count])].filter((one) => one >= 1 && one <= count).sort((a, b) => a - b);
  return numbers.flatMap((one, at) => {
    const skipped = one - (numbers[at - 1] ?? one) - 1;
    // One page left out is shown rather than a gap as wide as it.
    if (skipped === 1) return [one - 1, one];
    return skipped > 1 ? [GAP, one] : [one];
  });
}

// 44 px below 1180 px; 32 px at a desk, as a row's small button.
const PAGE = 'inline-flex min-h-touch min-w-touch items-center justify-center rounded-md px-2 font-text text-13 transition-colors focus-visible:outline focus-visible:outline-focus tablet:min-h-8 tablet:min-w-8';

export interface PagesProps {
  /** The table's name, which names its pages: "Members". */
  readonly label: string;
  /** The page shown, from 1. */
  readonly page: number;
  /** How many pages there are. */
  readonly count: number;
  readonly onPage: (page: number) => void;
}

/**
 * A table's pages, in its foot (redesign RD-13): each a button named "Page 2", the one shown marked as the current page
 * on a faint fill, at the foot's end.
 */
export function Pages({ label, page, count, onPage }: PagesProps) {
  return (
    <nav aria-label={t('ui.console.dataTable.pages', { table: label })} className="flex flex-wrap items-center justify-end gap-1">
      {pagesShown(page, count).map((one, at) => (one === GAP ? (
        // Between two numbers, so its place names it.
        <span key={`gap-${String(at)}`} aria-hidden="true" className="px-1 font-text text-13 text-content-muted">{t('ui.console.dataTable.pagesGap')}</span>
      ) : (
        <button key={one} type="button" aria-label={t('ui.console.dataTable.page', { page: formatNumber(one) })} aria-current={one === page ? 'page' : undefined}
          onClick={() => onPage(one)} className={cx(PAGE, one === page ? 'bg-subtle font-medium text-content' : 'text-content-muted hover:bg-subtle-hover hover:text-content')}>
          {formatNumber(one)}
        </button>
      )))}
    </nav>
  );
}
