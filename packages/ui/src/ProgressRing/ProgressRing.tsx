import type { ReactNode } from 'react';

export interface ProgressRingProps {
  /** How much is left, from 0 to 1: the gold arc's length. */
  fraction: number;
  /** `alert` turns the arc red: the call time's last 15 minutes. */
  tone?: 'gold' | 'alert';
  /** What sits in the middle: the time left and when it ends. */
  children: ReactNode;
}

const RADIUS = 110;
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
      <svg aria-hidden="true" viewBox="0 0 240 240" className="absolute inset-0 size-ring">
        <circle cx={120} cy={120} r={RADIUS} fill="none" strokeWidth={4} className="stroke-cream-track" />
        <circle cx={120} cy={120} r={RADIUS} fill="none" strokeWidth={4} strokeLinecap="round" data-ring-arc=""
          strokeDasharray={CIRCUMFERENCE} strokeDashoffset={offset} transform="rotate(-90 120 120)"
          className={tone === 'alert' ? 'stroke-alert' : 'stroke-gold'} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-1">{children}</div>
    </div>
  );
}
