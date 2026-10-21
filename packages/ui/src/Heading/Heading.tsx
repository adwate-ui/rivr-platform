import type { ReactNode } from 'react';
import { cx } from '../internal/classes.ts';

/**
 * `display` is set in the display face (Bodoni Moda) for TV
 * titles and the wordmark lockup; it is never smaller than 20 px. `poster` is the display face at its
 * largest: the hero of a social post with no figure, and the pairing code a TV shows across the room.
 * `tvTitle` is a TV board's title and tonight's high hand. `hero`, `band` and `statement` are the public
 * website's, set in capitals (decision 0118): its page's opening line, a band's heading, and a line set across
 * the page. `step` is the title of a step of sign-in or KYC.
 * The rest use the text face.
 */
export type HeadingVariant = 'display' | 'poster' | 'tvTitle' | 'hero' | 'band' | 'statement' | 'step' | 'title' | 'section' | 'subsection';

export interface HeadingProps {
  children: ReactNode;
  /** The document outline level, h1 to h4. One h1 per screen. */
  level: 1 | 2 | 3 | 4;
  /** The look; defaults to the size that matches the level. */
  variant?: HeadingVariant;
  align?: 'start' | 'center';
  id?: string;
  /** Heard by screen readers only: a screen whose name is an image, such as the wordmark, still has its h1. */
  isVisuallyHidden?: boolean;
}

const VARIANT: Record<HeadingVariant, string> = {
  display: 'font-display text-56 leading-tight font-regular',
  poster: 'font-display text-96 leading-tight font-regular',
  tvTitle: 'font-display text-88 leading-tight font-medium',
  hero: 'font-display text-48 leading-tight font-regular uppercase tablet:text-88',
  band: 'font-display text-36 leading-tight font-regular uppercase tablet:text-56',
  statement: 'font-display text-48 leading-tight font-regular uppercase tablet:text-96',
  step: 'font-text text-28 leading-snug font-medium',
  title: 'font-text text-24 leading-snug font-medium',
  section: 'font-text text-20 leading-snug font-semibold',
  subsection: 'font-text text-16 leading-snug font-semibold',
};

const DEFAULT_VARIANT = { 1: 'title', 2: 'section', 3: 'subsection', 4: 'subsection' } as const;

/** A heading. Headings are nouns (Balance, Waitlist, Tonight) with no subtitle beneath. */
export function Heading({ children, level, variant = DEFAULT_VARIANT[level], align = 'start', id, isVisuallyHidden }: HeadingProps) {
  const Element = `h${level}` as const;
  return (
    <Element className={cx('text-content', VARIANT[variant], align === 'center' && 'text-center', isVisuallyHidden && 'sr-only')} id={id}>
      {children}
    </Element>
  );
}
