import { cx } from '../internal/classes.ts';

/** One seat at a drill's table as the spot stands: its plate, where it stands in the hand, and any bet in front of it. */
export interface DrillSeat {
  /** "You · BTN", "Villain 1 · CO" or the seat's position. */
  readonly plate: string;
  readonly state: 'hero' | 'in_pot' | 'yet_to_act' | 'folded';
  /** The bet in front of the seat, such as "2.5 BB"; null for none. */
  readonly bet: string | null;
}

export interface DrillTableProps {
  /** The seats in table order; the hero's is drawn at the bottom. */
  seats: readonly DrillSeat[];
  /** The board's cards as written, such as "K♦"; none preflop. */
  board: readonly string[];
  /** The hero's two cards. */
  hole: readonly string[];
  /** The pot, such as "Pot 6 BB"; null before there is one. */
  pot: string | null;
}

const CENTRE = { x: 170, y: 112 };
// Wide enough for the plates to clear the felt, narrow enough for the side plates to stay in the drawing.
const ORBIT = { x: 124, y: 92 };
const CARD = { width: 22, height: 30 };

function seatAt(index: number, heroIndex: number, count: number): { x: number; y: number } {
  const angle = Math.PI / 2 + ((index - heroIndex) * 2 * Math.PI) / count;
  return { x: CENTRE.x + ORBIT.x * Math.cos(angle), y: CENTRE.y + ORBIT.y * Math.sin(angle) };
}

/** A card face, cream with its rank and suit. */
function CardFace({ label, x, y }: { label: string; x: number; y: number }) {
  return (
    <g>
      <rect x={x - CARD.width / 2} y={y - CARD.height / 2} width={CARD.width} height={CARD.height} rx={3} className="fill-cream stroke-hairline" />
      <text x={x} y={y} textAnchor="middle" dominantBaseline="central" className="fill-on-cream font-text text-12 font-semibold">{label}</text>
    </g>
  );
}

/** Where a seat's bet goes: on the felt side of its plate, clear of the board; the hero's beside their cards. */
function betPosition(at: { x: number; y: number }, isHero: boolean): { x: number; y: number } {
  if (isHero) return { x: at.x + 52, y: at.y - 30 };
  return { x: at.x + (CENTRE.x - at.x) * 0.2, y: at.y + (at.y > CENTRE.y ? -18 : 18) };
}

/** A seat's plate, and the bet in front of it. */
function Seat({ seat, at }: { seat: DrillSeat; at: { x: number; y: number } }) {
  const isHero = seat.state === 'hero';
  const betAt = betPosition(at, isHero);
  return (
    <g className={seat.state === 'folded' ? 'opacity-muted' : undefined}>
      <rect x={at.x - 38} y={at.y - 10} width={76} height={20} rx={4}
        className={cx(isHero ? 'fill-cream' : 'fill-green', seat.state === 'yet_to_act' ? 'stroke-hairline' : 'stroke-cream')} />
      <text x={at.x} y={at.y} textAnchor="middle" dominantBaseline="central"
        className={cx('font-text text-12', isHero ? 'fill-on-cream font-semibold' : 'fill-content')}>{seat.plate}</text>
      {seat.bet === null ? null : (
        <text x={betAt.x} y={betAt.y} textAnchor="middle" dominantBaseline="central" className="fill-money font-text text-12 font-medium">{seat.bet}</text>
      )}
    </g>
  );
}

/**
 * A drill's table seen from above (#133): nine seats on an oval with the hero at the bottom, folded seats dimmed,
 * the bets in front of seats, the board and the pot in the middle, and the hero's cards. It is a picture only: the
 * screen reads the spot once in words, so the drawing is hidden from screen readers.
 */
export function DrillTable({ seats, board, hole, pot }: DrillTableProps) {
  const heroIndex = Math.max(0, seats.findIndex((seat) => seat.state === 'hero'));
  const hero = seatAt(heroIndex, heroIndex, seats.length);
  const boardStart = CENTRE.x - ((board.length - 1) * (CARD.width + 4)) / 2;
  return (
    <svg viewBox="0 0 340 236" aria-hidden="true" className="w-full">
      <ellipse cx={CENTRE.x} cy={CENTRE.y} rx={112} ry={62} className="fill-green-black stroke-hairline" />
      {pot === null ? null : <text x={CENTRE.x} y={CENTRE.y - 28} textAnchor="middle" className="fill-content font-text text-12 font-medium">{pot}</text>}
      {board.map((card, index) => <CardFace key={`${card}-${String(index)}`} label={card} x={boardStart + index * (CARD.width + 4)} y={CENTRE.y} />)}
      {seats.map((seat, index) => <Seat key={`${seat.plate}-${String(index)}`} seat={seat} at={seatAt(index, heroIndex, seats.length)} />)}
      {hole.map((card, index) => <CardFace key={`${card}-${String(index)}`} label={card} x={hero.x - 13 + index * 26} y={hero.y - 30} />)}
    </svg>
  );
}
