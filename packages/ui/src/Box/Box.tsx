import type { ReactNode } from 'react';
import { cx } from '../internal/classes.ts';
import { PADDING, PADDING_X, PADDING_Y, type Space } from '../internal/space.ts';

/** The page background, a raised surface (nav, rows, sheets), a cream tile or an alert fill (banners). */
export type BoxSurface = 'none' | 'surface' | 'raised' | 'cream' | 'alert';

/** Which edges carry the 1 px gold hairline. */
export type BoxHairline = 'none' | 'top' | 'bottom' | 'all';

export interface BoxProps {
  children?: ReactNode;
  /** The HTML element; pick the landmark or section that describes the content. */
  as?: 'div' | 'section' | 'article' | 'header' | 'footer' | 'aside';
  padding?: Space;
  paddingX?: Space;
  paddingY?: Space;
  surface?: BoxSurface;
  hairline?: BoxHairline;
  radius?: 'none' | 'sm' | 'md' | 'lg';
  /** Fills the remaining space in a Stack or Inline. */
  grow?: boolean;
  id?: string;
  'aria-label'?: string;
  'aria-labelledby'?: string;
}

const SURFACE: Record<BoxSurface, string> = {
  none: '',
  surface: 'bg-surface text-content',
  raised: 'bg-raised text-content',
  cream: 'bg-cream text-on-cream',
  alert: 'bg-alert text-on-alert',
};

const HAIRLINE: Record<BoxHairline, string> = {
  none: '',
  top: 'border-t border-hairline',
  bottom: 'border-b border-hairline',
  all: 'border border-hairline',
};

const RADIUS = { none: '', sm: 'rounded-sm', md: 'rounded-md', lg: 'rounded-lg' } as const;

type BoxLook = Pick<BoxProps, 'padding' | 'paddingX' | 'paddingY' | 'surface' | 'hairline' | 'radius' | 'grow'>;

function boxClasses({ padding, paddingX, paddingY, surface = 'none', hairline = 'none', radius = 'none', grow = false }: BoxLook): string {
  return cx(
    padding !== undefined && PADDING[padding],
    paddingX !== undefined && PADDING_X[paddingX],
    paddingY !== undefined && PADDING_Y[paddingY],
    SURFACE[surface],
    HAIRLINE[hairline],
    RADIUS[radius],
    grow && 'min-w-0 flex-1',
  );
}

/** A plain block with token padding, a surface, hairlines and a radius. The base of every layout. */
export function Box({ children, as: Element = 'div', id, 'aria-label': ariaLabel, 'aria-labelledby': ariaLabelledBy, ...look }: BoxProps) {
  return (
    <Element className={boxClasses(look) || undefined} id={id} aria-label={ariaLabel} aria-labelledby={ariaLabelledBy}>
      {children}
    </Element>
  );
}
