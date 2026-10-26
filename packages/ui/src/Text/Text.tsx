import type { ReactNode } from 'react';
import { cx } from '../internal/classes.ts';
import { TONE, type TextTone } from '../internal/tone.ts';

export type { TextTone };

/**
 * Body copy sizes. `tvLabel` is the letter-spaced capitals label on the TV. `tvBody` is body copy on
 * large canvases: the TV and social posts. `posterLabel` is the letter-spaced capitals label on a
 * social post, large enough to read once the post is shrunk to a phone's width.
 */
export type TextVariant = 'body' | 'small' | 'caption' | 'label' | 'lead' | 'eyebrow' | 'tvLabel' | 'tvBody' | 'posterLabel';

export interface TextProps {
  children: ReactNode;
  variant?: TextVariant;
  tone?: TextTone;
  weight?: 'regular' | 'medium' | 'semibold';
  as?: 'p' | 'span' | 'div';
  align?: 'start' | 'center' | 'end';
  /** Cuts a single line with an ellipsis instead of wrapping. */
  truncate?: boolean;
  /** Figures of one width, so a clock ticking down does not shift: `11:32`. */
  isTabular?: boolean;
  id?: string;
}

const VARIANT: Record<TextVariant, string> = {
  body: 'text-16 leading-normal',
  small: 'text-14 leading-normal',
  caption: 'text-12 leading-normal',
  label: 'text-14 leading-snug font-medium',
  lead: 'text-18 leading-snug',
  eyebrow: 'text-12 leading-snug font-medium uppercase tracking-tv',
  tvLabel: 'text-24 leading-snug font-medium uppercase tracking-tv',
  tvBody: 'text-36 leading-snug',
  posterLabel: 'text-36 leading-snug font-medium uppercase tracking-tv',
};

const WEIGHT = { regular: 'font-regular', medium: 'font-medium', semibold: 'font-semibold' } as const;

const ALIGN = { start: 'text-start', center: 'text-center', end: 'text-end' } as const;

/** Running text in the text face. */
export function Text({ children, variant = 'body', tone = 'default', weight, as: Element = 'p', align, truncate = false, isTabular = false, id }: TextProps) {
  const classes = cx(
    'font-text',
    VARIANT[variant],
    TONE[tone],
    weight && WEIGHT[weight],
    align && ALIGN[align],
    truncate && 'truncate',
    isTabular && 'tabular-nums',
  );
  return (
    <Element className={classes} id={id}>
      {children}
    </Element>
  );
}
