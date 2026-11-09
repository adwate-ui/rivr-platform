/** Text colour by meaning. `money` is gold: money that belongs to the player. */
export type TextTone = 'default' | 'muted' | 'money' | 'accent' | 'danger' | 'onCream' | 'onAction' | 'onAlert' | 'inherit';

/** The Tailwind class for each tone; shared by Text, Heading and the figure components. */
export const TONE: Record<TextTone, string> = {
  default: 'text-content',
  muted: 'text-content-muted',
  money: 'text-money',
  /** A website eyebrow: gold, green on a cream band. */
  accent: 'text-accent',
  /** The console's danger red: what ran past its target, with the word beside it. */
  danger: 'text-danger',
  onCream: 'text-on-cream',
  onAction: 'text-on-action',
  onAlert: 'text-on-alert',
  inherit: '',
};

/**
 * Sizes for a figure (money, a count, a time, stakes). `stat`, `timer`, `display`, `hold`, `jackpot`, `place` and
 * `tvJackpot` use the display face; `tvJackpot` is the TV's jackpot figure, the largest on any screen.
 */
export type FigureSize = 'small' | 'body' | 'lead' | 'title' | 'numeral' | 'stat' | 'timer' | 'display' | 'hold' | 'jackpot' | 'place' | 'tvJackpot';

const FIGURE_SIZE: Record<FigureSize, string> = {
  small: 'text-14',
  body: 'text-16',
  lead: 'text-18 font-medium',
  title: 'text-28 leading-tight font-semibold',
  // The player redesign's figures (decision 0320): a stat, the call-time ring's clock, a seat's hold, a waitlist place.
  numeral: 'font-display text-24 leading-tight',
  stat: 'font-display text-32 leading-tight',
  timer: 'font-display text-48 leading-none',
  display: 'font-display text-56 leading-tight',
  hold: 'font-display text-72 leading-none',
  place: 'font-display text-160 leading-none',
  jackpot: 'font-display text-96 leading-tight',
  tvJackpot: 'font-display text-280 leading-tight font-medium',
};

/** Classes for a figure: tabular digits that never wrap, at a size and in a tone. */
export function figureClasses(size: FigureSize, tone: TextTone): string {
  return ['tabular-nums whitespace-nowrap', FIGURE_SIZE[size], TONE[tone]].filter(Boolean).join(' ');
}
