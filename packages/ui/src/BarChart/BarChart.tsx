import { useId } from 'react';
import { cx } from '../internal/classes.ts';

/** One bar: what it is of, under it ("21", "12 Nov"); how tall; and its figure in words, over it ("41", "3 h"). */
export interface ChartBar {
  readonly label: string;
  readonly value: number;
  readonly valueText: string;
}

export interface BarChartProps {
  /** What the chart shows, over it and read out: "Check-ins by hour". */
  label: string;
  /** The bars in order, the tallest filling the height. None, and only the label shows. */
  bars: readonly ChartBar[];
}

// The hours of a day keep their words; past that (a span of days) only some do, so the words do not run together. Below 768 px
// there is room for six.
const WORDED = 24;
const WORDED_NARROW = 6;
// Close bars are named on a line under them: eleven names from the first bar to the last, every other one below 768 px.
const SCALE_NAMES = 11;

/** Where a bar's words show: at every width, from 768 px, or to a screen reader alone. */
type Worded = 'always' | 'wide' | 'never';
const WORDS: Record<Worded, string> = { always: '', wide: 'max-medium:sr-only', never: 'sr-only' };

function wordedAt(index: number, count: number): Worded {
  const wide = Math.ceil(count / WORDED);
  if (index % wide !== 0) return 'never';
  // Of those worded from 768 px, every few are below it too.
  const narrow = wide * Math.ceil(count / wide / WORDED_NARROW);
  return index % narrow === 0 ? 'always' : 'wide';
}

/** A bar's share of the tallest, from 0 to 1. */
const shareOf = (value: number, most: number) => (most > 0 && Number.isFinite(value) ? Math.min(1, Math.max(0, value / most)) : 0);

/** One bar in its column: the space over it, its figure, the bar, and what it is of. Close bars keep their words for a screen reader alone. */
function Bar({ bar, share, worded, isClose }: { bar: ChartBar; share: number; worded: Worded; isClose: boolean }) {
  const words = cx('font-text text-12 whitespace-nowrap text-content-muted', isClose ? WORDS.never : WORDS[worded]);
  return (
    <li className="flex min-w-0 flex-1 flex-col items-center gap-1">
      <span className="flex h-16 w-full flex-col items-center">
        <span aria-hidden="true" className="min-h-0 basis-0" style={{ flexGrow: 1 - share }} />
        <span className="sr-only">{bar.label}: </span>
        <span className={words}>{bar.valueText}</span>
        <span aria-hidden="true" data-bar="" className="min-h-0 w-12 max-w-full basis-0 rounded-sm bg-gold" style={{ flexGrow: share }} />
      </span>
      <span aria-hidden="true" className={words}>{bar.label}</span>
    </li>
  );
}

/** The bars a scale names: the first, the last and those evenly between, so a name spread along the line stands under its bar. */
const scaleBars = (count: number) => Array.from({ length: SCALE_NAMES }, (_, place) => Math.round((place * (count - 1)) / (SCALE_NAMES - 1)));

/** Under close bars: what some are of, spread from the first to the last, so no two meet and none passes the tile's edge. */
function Scale({ bars }: { bars: readonly ChartBar[] }) {
  return (
    <div aria-hidden="true" data-scale="" className="flex justify-between gap-2 font-text text-12 whitespace-nowrap text-content-muted">
      {scaleBars(bars.length).map((index, place) => <span key={index} className={place % 2 === 0 ? WORDS.always : WORDS.wide}>{bars[index]?.label}</span>)}
    </div>
  );
}

/**
 * A row of bars on a raised tile (redesign RD-27, the Reports screen): a report's figure by the hour or by the day. Each
 * bar is as tall as its share of the tallest, with its figure over it and what it is of under it. A list to a screen
 * reader, each bar read as "21: 33". With more bars than a day has hours they stand close and show no figure; under them
 * a line names eleven from the first to the last, and six of them below 768 px.
 */
export function BarChart({ label, bars }: BarChartProps) {
  const most = Math.max(0, ...bars.map((bar) => bar.value));
  const captionId = useId();
  // Many bars stand closer, so ninety fit a phone.
  const isClose = bars.length > WORDED;
  const row = cx('flex items-stretch', isClose ? 'gap-px' : 'gap-1');
  return (
    <figure aria-labelledby={captionId} className="flex flex-col gap-3 rounded-lg bg-raised p-4">
      <figcaption id={captionId} className="font-text text-12 text-content-muted">{label}</figcaption>
      <ol className={row}>
        {bars.map((bar, index) => <Bar key={bar.label} bar={bar} share={shareOf(bar.value, most)} worded={wordedAt(index, bars.length)} isClose={isClose} />)}
      </ol>
      {isClose ? <Scale bars={bars} /> : null}
    </figure>
  );
}
