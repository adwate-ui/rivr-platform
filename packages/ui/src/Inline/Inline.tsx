import type { ReactNode } from 'react';
import { cx } from '../internal/classes.ts';
import { ALIGN, GAP, JUSTIFY, type Align, type Justify, type Space } from '../internal/space.ts';

export interface InlineProps {
  children: ReactNode;
  /** Space between children, a step of the token spacing scale. */
  gap?: Space;
  align?: Align;
  justify?: Justify;
  /** Lets children move to a new line when the row is full. */
  wrap?: boolean;
  /** Fills the remaining space when nested in a Stack or another Inline. */
  grow?: boolean;
  as?: 'div' | 'ul' | 'ol';
  'aria-label'?: string;
}

/** Lays children out side by side with token spacing, centred on the cross axis by default. */
export function Inline({ children, gap = 2, align = 'center', justify = 'start', wrap = false, grow = false, as: Element = 'div', ...labelling }: InlineProps) {
  const classes = cx('flex flex-row', GAP[gap], ALIGN[align], JUSTIFY[justify], wrap && 'flex-wrap', grow && 'min-w-0 flex-1');
  return (
    <Element className={classes} {...labelling}>
      {children}
    </Element>
  );
}
