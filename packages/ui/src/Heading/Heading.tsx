import type { ReactNode } from 'react';
import { cx } from '../internal/classes.ts';

/**
 * `display` is set in the display face (Bodoni Moda) for TV
 * titles and the wordmark lockup; it is never smaller than 20 px. The rest use the text face.
 */
export type HeadingVariant = 'display' | 'title' | 'section' | 'subsection';

export interface HeadingProps {
  children: ReactNode;
  /** The document outline level, h1 to h4. One h1 per screen. */
  level: 1 | 2 | 3 | 4;
  /** The look; defaults to the size that matches the level. */
  variant?: HeadingVariant;
  align?: 'start' | 'center';
  id?: string;
}

const VARIANT: Record<HeadingVariant, string> = {
  display: 'font-display text-56 leading-tight font-regular',
  title: 'font-text text-24 leading-snug font-medium',
  section: 'font-text text-20 leading-snug font-semibold',
  subsection: 'font-text text-16 leading-snug font-semibold',
};

const DEFAULT_VARIANT = { 1: 'title', 2: 'section', 3: 'subsection', 4: 'subsection' } as const;

/** A heading. Headings are nouns (Balance, Waitlist, Tonight) with no subtitle beneath. */
export function Heading({ children, level, variant = DEFAULT_VARIANT[level], align = 'start', id }: HeadingProps) {
  const Element = `h${level}` as const;
  return (
    <Element className={cx('text-content', VARIANT[variant], align === 'center' && 'text-center')} id={id}>
      {children}
    </Element>
  );
}
