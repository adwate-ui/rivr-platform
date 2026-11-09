import { tokens } from '@rivr/tokens';
import type { ReactNode } from 'react';

export interface ProgressRingProps {
  /** How much is left, from 0 to 1: the gold arc's length. */
  fraction: number;
  /** `alert` turns the arc danger pink, as red would be 2.08:1 on green: the call time's last 15 minutes (F-161). */
  tone?: 'gold' | 'alert';
  /** What sits in the middle: the time left and when it ends. */
  children: ReactNode;
}

// The drawing is in the ring's own units: the arc sits at 11/24 of it and is 1/60 of it wide.
const SIZE = tokens.size.ring;
const CENTRE = SIZE / 2;
const RADIUS = (SIZE * 11) / 24;
const STROKE = SIZE / 60;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

/** Keeps a fraction between 0 and 1, so an overdue or unknown clock never draws past the ring. */
const clamp = (fraction: number) => (Number.isFinite(fraction) ? Math.min(1, Math.max(0, fraction)) : 0);

/**
 * The call-time ring on Tonight (decision 0320): a 236 px circle, a 4 px gold arc for what is left on a faint track,
 * moving on each second, linear, with the time in the middle. The arc starts at the top and runs clockwise.
 */
export function ProgressRing({ fraction, tone = 'gold', children }: ProgressRingProps) {
  const offset = CIRCUMFERENCE * (1 - clamp(fraction));
  return (
    <div className="relative size-ring">
      <svg aria-hidden="true" viewBox={`0 0 ${SIZE} ${SIZE}`} className="absolute inset-0 size-ring">
        <circle cx={CENTRE} cy={CENTRE} r={RADIUS} fill="none" strokeWidth={STROKE} className="stroke-cream-track" />
        <circle cx={CENTRE} cy={CENTRE} r={RADIUS} fill="none" strokeWidth={STROKE} strokeLinecap="round" data-ring-arc=""
          strokeDasharray={CIRCUMFERENCE} strokeDashoffset={offset} transform={`rotate(-90 ${CENTRE} ${CENTRE})`}
          className={tone === 'alert' ? 'stroke-danger' : 'stroke-gold'} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-1">{children}</div>
    </div>
  );
}
