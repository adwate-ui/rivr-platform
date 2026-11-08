import type { ReactNode } from 'react';
import { cx } from '../internal/classes.ts';
import { STICKY_BAR_TOP } from '../internal/consoleMain.ts';
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
  /** `card`, 8 px, the player redesign's card and QR panel (decision 0320). */
  radius?: 'none' | 'sm' | 'md' | 'lg' | 'card';
  /** Fills the remaining space in a Stack or Inline. */
  grow?: boolean;
  /**
   * Stays in view at the top as the page scrolls, from 768 px, beside a longer column in a Grid: the promotion builder's
   * summary (console v3). Below 768 px the columns stack and it scrolls with the page.
   */
  isSticky?: boolean;
  /** Keeps the box, the whole width of its column, at the top of the console's main: a long form's actions (F-029). The offset takes off main's own top padding, which a sticky box would otherwise stop short of. */
  isStickyBar?: boolean;
  id?: string;
  'aria-label'?: string;
  'aria-labelledby'?: string;
  /** Reads changes out politely, such as an order moving on (decision 0320). */
  isLive?: boolean;
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

const RADIUS = { none: '', sm: 'rounded-sm', md: 'rounded-md', lg: 'rounded-lg', card: 'rounded-card' } as const;

type BoxLook = Pick<BoxProps, 'padding' | 'paddingX' | 'paddingY' | 'surface' | 'hairline' | 'radius' | 'grow' | 'isSticky' | 'isStickyBar'>;

// A grid cell stretches to its row by default, and a stretched cell has nowhere to stick: a sticky box keeps its own height.
const STICKY = 'medium:sticky medium:top-0 medium:self-start';

/** How the box sits among its neighbours: filling the space left, or held in view as the page scrolls. */
function placeClasses({ grow = false, isSticky = false, isStickyBar = false }: BoxLook): string {
  return cx(grow && 'min-w-0 flex-1', isSticky && STICKY, isStickyBar && `sticky ${STICKY_BAR_TOP} z-nav`);
}

function boxClasses(look: BoxLook): string {
  const { padding, paddingX, paddingY, surface = 'none', hairline = 'none', radius = 'none' } = look;
  return cx(
    padding !== undefined && PADDING[padding],
    paddingX !== undefined && PADDING_X[paddingX],
    paddingY !== undefined && PADDING_Y[paddingY],
    SURFACE[surface],
    HAIRLINE[hairline],
    RADIUS[radius],
    placeClasses(look),
  );
}

/**
 * A sticky bar's height as its scroller's scroll padding, with room for the focus ring, so a field reached by keyboard
 * stops clear of the bar however tall it is now: a second row, a status line or Publish later open (WCAG 2.4.11).
 */
function keepFocusClearOfBar(bar: HTMLElement | null) {
  const scroller = bar?.closest('main');
  if (!bar || !scroller || typeof ResizeObserver === 'undefined') return undefined;
  const observer = new ResizeObserver(() => scroller.style.setProperty('scroll-padding-top', `calc(${String(bar.offsetHeight)}px + var(--rivr-space-2))`));
  observer.observe(bar);
  return () => {
    observer.disconnect();
    scroller.style.removeProperty('scroll-padding-top');
  };
}

/** A plain block with token padding, a surface, hairlines and a radius. The base of every layout. */
export function Box({ children, as: Element = 'div', id, 'aria-label': ariaLabel, 'aria-labelledby': ariaLabelledBy, isLive, ...look }: BoxProps) {
  return (
    <Element data-surface={look.surface === 'raised' ? 'raised' : undefined} ref={look.isStickyBar ? keepFocusClearOfBar : undefined} className={boxClasses(look) || undefined} id={id} aria-label={ariaLabel} aria-labelledby={ariaLabelledBy}
      aria-live={isLive ? 'polite' : undefined}>
      {children}
    </Element>
  );
}
