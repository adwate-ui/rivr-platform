import type { ReactNode } from 'react';
import { cx } from '../internal/classes.ts';
import { GAP, type Space } from '../internal/space.ts';

/** Column counts the layouts use: the five-table floor, stat rows, the 12-column console. */
export type GridColumns = 1 | 2 | 3 | 4 | 5 | 6 | 12;

export interface GridProps {
  children: ReactNode;
  columns: GridColumns;
  /**
   * One column below 768 px (`medium`), `columns` from there up (#603), as a form or a row of stats stacks on a phone.
   * Without it the columns hold at every size, as a phone layout that wants them does.
   */
  stackBelow?: 'medium';
  gap?: Space;
  as?: 'div' | 'ul';
  'aria-label'?: string;
}

const COLUMNS: Record<GridColumns, string> = {
  1: 'grid-cols-1',
  2: 'grid-cols-2',
  3: 'grid-cols-3',
  4: 'grid-cols-4',
  5: 'grid-cols-5',
  6: 'grid-cols-6',
  12: 'grid-cols-12',
};

// Whole class names, so Tailwind finds each one in the source.
const FROM_MEDIUM: Record<GridColumns, string> = {
  1: 'medium:grid-cols-1',
  2: 'medium:grid-cols-2',
  3: 'medium:grid-cols-3',
  4: 'medium:grid-cols-4',
  5: 'medium:grid-cols-5',
  6: 'medium:grid-cols-6',
  12: 'medium:grid-cols-12',
};

function columnClasses(columns: GridColumns, stackBelow: GridProps['stackBelow']): string {
  return stackBelow === undefined ? COLUMNS[columns] : cx('grid-cols-1', FROM_MEDIUM[columns]);
}

/** Equal-width columns with token gaps, stacking into one below `stackBelow` when given. */
export function Grid({ children, columns, gap = 4, stackBelow, as: Element = 'div', ...labelling }: GridProps) {
  return (
    <Element className={cx('grid', columnClasses(columns, stackBelow), GAP[gap])} {...labelling}>
      {children}
    </Element>
  );
}
