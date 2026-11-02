import { figureClasses, type FigureSize, type TextTone } from '../internal/tone.ts';

export interface FigureProps {
  /** The figure as it reads: `2:41:08`, `1`, `3,250`, `404`. */
  children: string;
  size?: FigureSize;
  tone?: TextTone;
  /** `timer` for a clock counting down; give it a readable `aria-label` as well ("Call time left 2h 41m"). */
  role?: 'timer' | undefined;
  'aria-label'?: string | undefined;
}

/**
 * A figure already put in words, set large in tabular digits (decision 0320): the call time's clock, a seat's hold, a place
 * on a waitlist, a points balance. Number, Money and Time format their own; this shows one that is formatted.
 */
export function Figure({ children, size = 'display', tone = 'default', role, 'aria-label': ariaLabel }: FigureProps) {
  return (
    <span role={role} aria-label={ariaLabel} className={figureClasses(size, tone)}>
      {children}
    </span>
  );
}
