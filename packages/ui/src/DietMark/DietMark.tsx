import { t } from '@rivr/i18n';
import type { ReactElement } from 'react';
import { cx } from '../internal/classes.ts';

export type Diet = 'veg' | 'egg' | 'non_veg';

export interface DietMarkProps {
  /** What the dish is. */
  diet: Diet;
}

const TONE: Record<Diet, string> = { veg: 'text-diet-veg', egg: 'text-diet-egg', non_veg: 'text-diet-non-veg' };

const INNER: Record<Diet, ReactElement> = {
  veg: <circle cx="8" cy="8" r="3.5" fill="currentColor" />,
  egg: <circle cx="8" cy="8" r="3.25" fill="none" stroke="currentColor" strokeWidth="1.5" />,
  non_veg: <path d="M8 3.5 12.5 11.5H3.5Z" fill="currentColor" />,
};

/**
 * The food mark beside a menu item (F-052): a cream square edged in its colour, with FSSAI's dot for veg and triangle for
 * non-veg, and for egg, which FSSAI has no mark for, the club's own hollow ring, so the shape says it as well as the colour.
 */
export function DietMark({ diet }: DietMarkProps) {
  return (
    <svg viewBox="0 0 16 16" role="img" aria-label={t(`ui.dietMark.${diet}`)} className={cx('size-4 shrink-0', TONE[diet])}>
      <rect x="0.75" y="0.75" width="14.5" height="14.5" rx="2" strokeWidth="1.5" className="fill-cream stroke-current" />
      {INNER[diet]}
    </svg>
  );
}
