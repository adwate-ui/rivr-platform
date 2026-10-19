/** Text colour by meaning. `money` is gold: money that belongs to the player. */
export type TextTone = 'default' | 'muted' | 'money' | 'onCream' | 'onAction' | 'onAlert' | 'inherit';

/** The Tailwind class for each tone; shared by Text, Heading and the figure components. */
export const TONE: Record<TextTone, string> = {
  default: 'text-content',
  muted: 'text-content-muted',
  money: 'text-money',
  onCream: 'text-on-cream',
  onAction: 'text-on-action',
  onAlert: 'text-on-alert',
  inherit: '',
};

/**
 * Sizes for a figure (money, a count, a time, stakes). `display`, `jackpot` and `tvJackpot` use the
 * display face; `tvJackpot` is the TV's jackpot figure, the largest on any screen.
 */
export type FigureSize = 'small' | 'body' | 'lead' | 'title' | 'display' | 'jackpot' | 'tvJackpot';

const FIGURE_SIZE: Record<FigureSize, string> = {
  small: 'text-14',
  body: 'text-16',
  lead: 'text-18 font-medium',
  title: 'text-28 leading-tight font-semibold',
  display: 'font-display text-56 leading-tight',
  jackpot: 'font-display text-96 leading-tight',
  tvJackpot: 'font-display text-280 leading-tight font-medium',
};

/** Classes for a figure: tabular digits that never wrap, at a size and in a tone. */
export function figureClasses(size: FigureSize, tone: TextTone): string {
  return ['tabular-nums whitespace-nowrap', FIGURE_SIZE[size], TONE[tone]].filter(Boolean).join(' ');
}
