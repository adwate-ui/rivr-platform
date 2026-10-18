/**
 * Steps of the token spacing scale (4 px grid) and the Tailwind class for each use.
 * Classes are written out in full so Tailwind finds them when it scans the source.
 */
export type Space = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 8 | 10 | 12 | 16;

export const GAP: Record<Space, string> = {
  0: 'gap-0', 1: 'gap-1', 2: 'gap-2', 3: 'gap-3', 4: 'gap-4', 5: 'gap-5',
  6: 'gap-6', 8: 'gap-8', 10: 'gap-10', 12: 'gap-12', 16: 'gap-16',
};

export const PADDING: Record<Space, string> = {
  0: 'p-0', 1: 'p-1', 2: 'p-2', 3: 'p-3', 4: 'p-4', 5: 'p-5',
  6: 'p-6', 8: 'p-8', 10: 'p-10', 12: 'p-12', 16: 'p-16',
};

export const PADDING_X: Record<Space, string> = {
  0: 'px-0', 1: 'px-1', 2: 'px-2', 3: 'px-3', 4: 'px-4', 5: 'px-5',
  6: 'px-6', 8: 'px-8', 10: 'px-10', 12: 'px-12', 16: 'px-16',
};

export const PADDING_Y: Record<Space, string> = {
  0: 'py-0', 1: 'py-1', 2: 'py-2', 3: 'py-3', 4: 'py-4', 5: 'py-5',
  6: 'py-6', 8: 'py-8', 10: 'py-10', 12: 'py-12', 16: 'py-16',
};

/** A square of the given step, for Spacer. */
export const SIZE: Record<Space, string> = {
  0: 'size-0', 1: 'size-1', 2: 'size-2', 3: 'size-3', 4: 'size-4', 5: 'size-5',
  6: 'size-6', 8: 'size-8', 10: 'size-10', 12: 'size-12', 16: 'size-16',
};

/** Cross-axis alignment shared by Stack and Inline. */
export type Align = 'start' | 'center' | 'end' | 'stretch' | 'baseline';

export const ALIGN: Record<Align, string> = {
  start: 'items-start',
  center: 'items-center',
  end: 'items-end',
  stretch: 'items-stretch',
  baseline: 'items-baseline',
};

/** Main-axis distribution shared by Stack and Inline. */
export type Justify = 'start' | 'center' | 'end' | 'between';

export const JUSTIFY: Record<Justify, string> = {
  start: 'justify-start',
  center: 'justify-center',
  end: 'justify-end',
  between: 'justify-between',
};
