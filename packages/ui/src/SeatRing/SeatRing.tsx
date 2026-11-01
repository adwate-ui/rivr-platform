import { t } from '@rivr/i18n';
import type { KeyboardEvent } from 'react';
import { cx } from '../internal/classes.ts';

/** One seat at the table: its number, and the initials of who sits there, or null when it is open. */
export interface RingSeat {
  readonly number: number;
  readonly initials: string | null;
  /** Who sits there, for a seat a screen reader can choose. */
  readonly name?: string;
}

export interface SeatRingProps {
  /** The table's name and stakes, in the middle: "Table 3", "100/200". */
  name: string;
  stakes: string;
  seats: readonly RingSeat[];
  /** What a screen reader hears for the whole table, such as "Table 3, 8 of 9 seats taken". */
  label: string;
  /** A closed table is dimmed. */
  isClosed?: boolean;
  /** Makes each seat a button, with its number under it, as on the dealer tablet (#59). */
  onSelectSeat?: (seat: number) => void;
  /** The seat chosen, ringed. */
  selectedSeat?: number | null;
}

const CENTRE = { x: 120, y: 75 };
// Seats sit on a wider oval than the table, seat 1 at the top and on clockwise, as on the felt.
const SEAT_ORBIT = { x: 104, y: 60 };

function seatPosition(index: number, count: number): { x: number; y: number } {
  const angle = -Math.PI / 2 + (index * 2 * Math.PI) / count;
  return { x: CENTRE.x + SEAT_ORBIT.x * Math.cos(angle), y: CENTRE.y + SEAT_ORBIT.y * Math.sin(angle) };
}

function seatName(seat: RingSeat): string {
  return seat.initials === null ? t('ui.seatRing.open', { number: seat.number }) : t('ui.seatRing.taken', { number: seat.number, name: seat.name ?? seat.initials });
}

/**
 * How a seat is drawn, in the ring's viewBox units: on the tablet, at its own size, with how far a taken seat's label sits
 * above or below its circle; on a console's table card, where the ring is drawn small, with a larger circle and type, so
 * its initials stay legible (UI polish audit UI-14).
 */
const LOOK = {
  choosing: { radius: 11, type: 'text-12', labelAbove: 16, labelBelow: 24 },
  card: { radius: 14, type: 'text-16' },
} as const;

/** A taken seat's number on the tablet: above a seat in the ring's top half, below one in its bottom half, never over the felt. */
function SeatLabel({ number, at }: { number: number; at: { x: number; y: number } }) {
  const y = at.y < CENTRE.y ? at.y - LOOK.choosing.labelAbove : at.y + LOOK.choosing.labelBelow;
  return <text x={at.x} y={y} textAnchor="middle" className="fill-content-muted font-text text-12">{t('ui.seatRing.seat', { number })}</text>;
}

/** A seat's circle and what it says: the initials of who sits there, or its number when it is open. */
function SeatMark({ seat, at, isSelected, look }: { seat: RingSeat; at: { x: number; y: number }; isSelected: boolean; look: (typeof LOOK)[keyof typeof LOOK] }) {
  const isTaken = seat.initials !== null;
  const ring = isSelected ? 'stroke-gold' : isTaken ? 'stroke-cream' : 'stroke-hairline';
  return (
    <>
      <circle cx={at.x} cy={at.y} r={look.radius} strokeWidth={isSelected ? 2 : 1} className={cx(isTaken ? 'fill-cream' : 'fill-green', ring)} />
      <text x={at.x} y={at.y} textAnchor="middle" dominantBaseline="central"
        className={cx('font-text', look.type, isTaken ? 'fill-on-cream font-semibold' : 'fill-content-muted')}>
        {seat.initials ?? seat.number}
      </text>
    </>
  );
}

/**
 * One seat: a circle with initials, or its number when open. On the tablet a taken seat is a button with its number beside
 * it, away from the felt; an open one's circle already says it (UI-14).
 */
function Seat({ seat, at, isSelected, onSelect }: { seat: RingSeat; at: { x: number; y: number }; isSelected: boolean; onSelect?: ((seat: number) => void) | undefined }) {
  const press = (event: KeyboardEvent) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    onSelect?.(seat.number);
  };
  const button = onSelect ? { role: 'button', tabIndex: 0, 'aria-label': seatName(seat), 'aria-pressed': isSelected, onClick: () => onSelect(seat.number), onKeyDown: press } : {};
  return (
    <g {...button} className={onSelect ? 'cursor-pointer focus-visible:outline-2 focus-visible:outline-focus' : undefined}>
      <SeatMark seat={seat} at={at} isSelected={isSelected} look={onSelect ? LOOK.choosing : LOOK.card} />
      {onSelect && seat.initials !== null ? <SeatLabel number={seat.number} at={at} /> : null}
    </g>
  );
}

/**
 * The felt's name type: larger on a card, so it reads when the ring is drawn small, unless the name is longer than the felt
 * holds at that size (about 12 characters), as on the tablet.
 */
function nameType(name: string, isChoosing: boolean): string {
  return isChoosing || name.length > 12 ? 'text-14' : 'text-18';
}

/**
 * The table's parts in viewBox units, inside the seats' orbit (SEAT_ORBIT, 104 by 60) with room for a card's seat circles:
 * the rail, the felt inside it, the racetrack line on the felt, and the dealer's tray at the felt's foot.
 */
/** The halo behind the felt's words, in viewBox units. */
const HALO = 4;

const TABLE = {
  rail: { rx: 76, ry: 44 },
  felt: { rx: 66, ry: 35 },
  racetrack: { rx: 57, ry: 26 },
  tray: { width: 24, height: 5, corner: 1.5, fromFoot: 7 },
} as const;

/**
 * The table from above, drawn from the tokens (UI polish audit AS-08; no licensed top-down table photograph exists,
 * decision 0289): the rail warm with the hairline gold, so it shows on a raised card as on the page, the green felt
 * inside it, the racetrack's hairline, and the dealer's tray at the foot of the table.
 */
function TableArt() {
  const { rail, felt, racetrack, tray } = TABLE;
  return (
    <g aria-hidden="true">
      <ellipse cx={CENTRE.x} cy={CENTRE.y} rx={rail.rx} ry={rail.ry} className="fill-hairline stroke-hairline" />
      <ellipse cx={CENTRE.x} cy={CENTRE.y} rx={felt.rx} ry={felt.ry} className="fill-green stroke-hairline" />
      <ellipse cx={CENTRE.x} cy={CENTRE.y} rx={racetrack.rx} ry={racetrack.ry} className="fill-none stroke-hairline" />
      <rect x={CENTRE.x - tray.width / 2} y={CENTRE.y + felt.ry - tray.fromFoot} width={tray.width} height={tray.height} rx={tray.corner}
        className="fill-green-black stroke-hairline" />
    </g>
  );
}

/**
 * A table seen from above, as on the console's live floor: the felt with its name and stakes, and
 * every seat around it, with the initials of who sits there or the seat number when it is open. With
 * `onSelectSeat`, as on the dealer tablet, each seat is a button to choose, and the ring is no wider than the text measure,
 * so all of it fits a tablet's screen in either orientation (UI-14).
 */
export function SeatRing({ name, stakes, seats, label, isClosed, onSelectSeat, selectedSeat = null }: SeatRingProps) {
  const isChoosing = onSelectSeat !== undefined;
  return (
    <svg viewBox={isChoosing ? '0 -16 240 186' : '0 -4 240 158'} role={isChoosing ? 'group' : 'img'} aria-label={label}
      className={cx('w-full', isChoosing && 'mx-auto max-w-text', isClosed && 'opacity-muted')}>
      <TableArt />
      {/* A halo of the felt's green behind each glyph keeps the words at their contrast where a long name or stakes runs
          over the racetrack line or onto the rail (ui.md, 4.5:1). */}
      <text x={CENTRE.x} y={CENTRE.y - 4} textAnchor="middle" paintOrder="stroke" strokeWidth={HALO}
        className={cx('fill-content stroke-green font-text font-medium', nameType(name, isChoosing))}>{name}</text>
      <text x={CENTRE.x} y={CENTRE.y + 15} textAnchor="middle" paintOrder="stroke" strokeWidth={HALO}
        className={cx('fill-content-muted stroke-green font-text', isChoosing ? 'text-12' : 'text-16')}>{stakes}</text>
      {seats.map((seat, index) => (
        <Seat key={seat.number} seat={seat} at={seatPosition(index, seats.length)} isSelected={seat.number === selectedSeat} onSelect={onSelectSeat} />
      ))}
    </svg>
  );
}
