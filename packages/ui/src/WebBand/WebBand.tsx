import type { ReactNode } from 'react';
import { cx } from '../internal/classes.ts';

/** A band's colour: green-black, green, or cream with ink text (decision 0118). */
export type WebBandTone = 'dark' | 'deep' | 'cream';

export interface WebBandProps {
  tone: WebBandTone;
  /** One website block. */
  children: ReactNode;
  /** A band the page refreshes in place while it is open (#130), such as `games`: its key. */
  live?: string | undefined;
  /** The band's anchor, so a link can lead to it: `the-room` for `/#the-room` (#616). */
  anchor?: string | undefined;
}

const TONE: Record<WebBandTone, string> = { dark: 'bg-raised', deep: 'bg-surface', cream: 'bg-cream' };

/**
 * A full-width band of the public website holding one block, as grandpokerarena.com's page is made of
 * (#441, decision 0118). On a cream band every block reads in ink, through `[data-band='cream']` in styles.css.
 */
export function WebBand({ tone, children, live, anchor }: WebBandProps) {
  return (
    <div id={anchor} data-band={tone} data-live={live} className={cx('w-full scroll-mt-header', TONE[tone])}>
      {children}
    </div>
  );
}
