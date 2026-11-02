import { t } from '@rivr/i18n';
import { cx } from '../internal/classes.ts';

export interface SeatMapProps {
  /** Seats round the table, numbered from 1: nine unless given. */
  seatCount?: number;
  /** The seat numbers no one sits in. Display only: a member does not choose a seat. */
  openSeats: readonly number[];
  /** What the map shows, read out: "3 of 9 seats open". */
  label: string;
}

// The drawing's own units: the sheet's width at a phone's, 170 high (size.seatMap).
const WIDTH = 334;
const HEIGHT = 170;
const SEAT_RADIUS = 17;

/** Seat `n` sits at 270° + n·36° round an ellipse at 44% of the width and 42% of the height, as in the prototype: nine
 * seats leave the dealer's gap at the top, a tenth fills it. */
export function seatPosition(seat: number): { x: number; y: number } {
  const angle = ((270 + seat * 36) * Math.PI) / 180;
  return { x: WIDTH / 2 + 0.44 * WIDTH * Math.cos(angle), y: HEIGHT / 2 + 0.42 * HEIGHT * Math.sin(angle) };
}

/**
 * The table from above (decision 0320): the felt in a wooden rim with the club's name, and its numbered seats round it,
 * open seats gold, taken ones muted. A picture with one name for a screen reader; it holds no names of players.
 */
export function SeatMap({ seatCount = 9, openSeats, label }: SeatMapProps) {
  return (
    <svg role="img" aria-label={label} viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="h-seat-map w-full overflow-visible">
      <rect x={44} y={30} width={WIDTH - 88} height={HEIGHT - 60} rx={(HEIGHT - 60) / 2} strokeWidth={6} className="fill-green stroke-rim" />
      <rect x={47} y={33} width={WIDTH - 94} height={HEIGHT - 66} rx={(HEIGHT - 66) / 2} fill="none" strokeWidth={1} className="stroke-gold-edge" />
      <text x={WIDTH / 2} y={HEIGHT / 2} textAnchor="middle" dominantBaseline="central" className="fill-seat-taken font-display text-20">
        {t('ui.brand.name')}
      </text>
      {Array.from({ length: seatCount }, (_, index) => {
        const seat = index + 1;
        const isOpen = openSeats.includes(seat);
        const { x, y } = seatPosition(seat);
        return (
          <g key={seat} data-seat={seat} data-open={isOpen || undefined}>
            <circle cx={x} cy={y} r={SEAT_RADIUS} strokeWidth={1} className={isOpen ? 'fill-gold-tint stroke-gold' : 'fill-green-black stroke-cream-faint'} />
            <text x={x} y={y} textAnchor="middle" dominantBaseline="central"
              className={cx('font-text text-13 font-semibold', isOpen ? 'fill-gold' : 'fill-muted')}>
              {seat}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
