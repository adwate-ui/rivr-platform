import { useEffect, useRef, type ReactNode } from 'react';
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
export type HeadingVariant = 'display' | 'poster' | 'tvTitle' | 'tvCode' | 'hero' | 'band' | 'statement' | 'step' | 'title' | 'section' | 'subsection' | 'serif';

/** The display face's sizes for `serif`, the player redesign's titles (decision 0320): a screen's is 36, a sheet's 32. */
export type SerifSize = 28 | 32 | 36 | 40 | 44 | 48;

export interface HeadingProps {
  children: ReactNode;
  /** The document outline level, h1 to h4. One h1 per screen. */
  level: 1 | 2 | 3 | 4;
  /** The look; defaults to the size that matches the level. */
  variant?: HeadingVariant;
  /** With `serif`: its size, 36 unless given. */
  serifSize?: SerifSize;
  align?: 'start' | 'center';
  id?: string;
  /** Heard by screen readers only: a screen whose name is an image, such as the wordmark, still has its h1. */
  isVisuallyHidden?: boolean;
  /** A screen's h1, which takes the focus when the screen opens, so a keyboard or screen reader starts there (F5-03). */
  isFocusTarget?: boolean;
  /**
   * A form's heading, opened below what opened it, such as the live floor's Move: it takes the focus itself as it opens, so
   * a keyboard or screen reader starts at the form (F2-24).
   */
  isFocusedOnMount?: boolean;
}

const VARIANT: Record<HeadingVariant, string> = {
  display: 'font-display text-56 leading-tight font-regular',
  poster: 'font-display text-96 leading-tight font-regular',
  tvTitle: 'font-display text-88 leading-tight font-medium optical-tv',
  // A code staff type from across a room (D-01): the text face, whose 4 never reads as a 1.
  tvCode: 'font-text text-96 leading-tight font-semibold tabular-nums tracking-tv',
  hero: 'font-display text-36 leading-tight font-regular uppercase tablet:text-88',
  band: 'font-display text-36 leading-tight font-regular uppercase tablet:text-56',
  statement: 'font-display text-36 leading-tight font-regular uppercase tablet:text-96',
  step: 'font-text text-28 leading-snug font-medium',
  title: 'font-text text-24 leading-snug font-medium',
  section: 'font-text text-20 leading-snug font-semibold',
  subsection: 'font-text text-16 leading-snug font-semibold',
  serif: 'font-display leading-tight font-regular',
};

const SERIF_SIZE: Record<SerifSize, string> = { 28: 'text-28', 32: 'text-32', 36: 'text-36', 40: 'text-40', 44: 'text-44', 48: 'text-48' };

const DEFAULT_VARIANT = { 1: 'title', 2: 'section', 3: 'subsection', 4: 'subsection' } as const;

/** A heading. Headings are nouns (Balance, Waitlist, Tonight) with no subtitle beneath. */
export function Heading({ children, level, variant = DEFAULT_VARIANT[level], serifSize = 36, align = 'start', id, isVisuallyHidden, isFocusTarget, isFocusedOnMount }: HeadingProps) {
  const Element = `h${level}` as const;
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (isFocusedOnMount === true) heading.current?.focus();
  }, [isFocusedOnMount]);
  const isFocusable = isFocusTarget === true || isFocusedOnMount === true;
  return (
    <Element ref={heading} className={cx('text-content', VARIANT[variant], variant === 'serif' && SERIF_SIZE[serifSize], align === 'center' && 'text-center', isVisuallyHidden && 'sr-only', isFocusable && 'outline-none')}
      id={id} tabIndex={isFocusable ? -1 : undefined}>
      {children}
    </Element>
  );
}
