import type { ReactNode } from 'react';
import { cx } from '../internal/classes.ts';

/** A band's colour: green-black, green, or cream with ink text (decision 0118). */
export type WebBandTone = 'dark' | 'deep' | 'cream';

export interface WebBandProps {
  tone: WebBandTone;
  /** One website block. */
  children: ReactNode;
}

const TONE: Record<WebBandTone, string> = { dark: 'bg-raised', deep: 'bg-surface', cream: 'bg-cream' };

/**
 * A full-width band of the public website holding one block, as grandpokerarena.com's page is made of
 * (#441, decision 0118). On a cream band every block reads in ink, through `[data-band='cream']` in styles.css.
 */
export function WebBand({ tone, children }: WebBandProps) {
  return (
    <div data-band={tone} className={cx('w-full', TONE[tone])}>
      {children}
    </div>
  );
}
