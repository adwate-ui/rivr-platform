/** One seat at the table: its number, and the initials of who sits there, or null when it is open. */
export interface RingSeat {
  readonly number: number;
  readonly initials: string | null;
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
}

const CENTRE = { x: 120, y: 75 };
// Seats sit on a wider oval than the table, seat 1 at the top and on clockwise, as on the felt.
const SEAT_ORBIT = { x: 104, y: 60 };

function seatPosition(index: number, count: number): { x: number; y: number } {
  const angle = -Math.PI / 2 + (index * 2 * Math.PI) / count;
  return { x: CENTRE.x + SEAT_ORBIT.x * Math.cos(angle), y: CENTRE.y + SEAT_ORBIT.y * Math.sin(angle) };
}

/**
 * A table seen from above, as on the console's live floor: the felt with its name and stakes, and
 * every seat around it, with the initials of who sits there or the seat number when it is open.
 */
export function SeatRing({ name, stakes, seats, label, isClosed }: SeatRingProps) {
  return (
    <svg viewBox="0 0 240 150" role="img" aria-label={label} className={isClosed ? 'w-full opacity-muted' : 'w-full'}>
      <ellipse cx={CENTRE.x} cy={CENTRE.y} rx={74} ry={44} className="fill-green-black stroke-hairline" />
      <text x={CENTRE.x} y={CENTRE.y - 4} textAnchor="middle" className="fill-content font-text text-14 font-medium">{name}</text>
      <text x={CENTRE.x} y={CENTRE.y + 13} textAnchor="middle" className="fill-content-muted font-text text-12">{stakes}</text>
      {seats.map((seat, index) => {
        const at = seatPosition(index, seats.length);
        const isTaken = seat.initials !== null;
        return (
          <g key={seat.number}>
            <circle cx={at.x} cy={at.y} r={11} className={isTaken ? 'fill-cream stroke-cream' : 'fill-green stroke-hairline'} />
            <text x={at.x} y={at.y} textAnchor="middle" dominantBaseline="central"
              className={isTaken ? 'fill-on-cream font-text text-12 font-semibold' : 'fill-content-muted font-text text-12'}>
              {seat.initials ?? seat.number}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
