import type { ReactNode } from 'react';
import { cx } from '../internal/classes.ts';
import { ALIGN, GAP, JUSTIFY, type Align, type Justify, type Space } from '../internal/space.ts';

export interface StackProps {
  children: ReactNode;
  /** Space between children, a step of the token spacing scale. */
  gap?: Space;
  align?: Align;
  justify?: Justify;
  /** Draws a gold hairline between children, with 12 px above and below each line, in place of the gap. */
  divided?: boolean;
  /** Fills the remaining space when nested in another Stack or Inline. */
  grow?: boolean;
  as?: 'div' | 'section' | 'ul' | 'ol' | 'form';
  'aria-label'?: string;
}

/** Lays children out top to bottom with token spacing. */
export function Stack({ children, gap = 4, align = 'stretch', justify = 'start', divided = false, grow = false, as: Element = 'div', ...labelling }: StackProps) {
  const classes = cx(
    'flex flex-col',
    divided ? 'divide-y divide-hairline *:py-3' : GAP[gap],
    ALIGN[align],
    JUSTIFY[justify],
    grow && 'min-h-0 flex-1',
  );
  return (
    <Element className={classes} {...labelling}>
      {children}
    </Element>
  );
}
