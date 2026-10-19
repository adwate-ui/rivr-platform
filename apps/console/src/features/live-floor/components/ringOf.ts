import type { FloorTable, HeldSeat, SeatedPlayer } from '@rivr/db';
import { t } from '@rivr/i18n';

/** Initials as the seat ring shows them: Ishaan Verma is IV. */
export function initialsOf(fullName: string): string {
  const words = fullName.trim().split(/\s+/);
  return `${words[0]?.[0] ?? ''}${words.length > 1 ? words[words.length - 1]?.[0] ?? '' : ''}`.toUpperCase();
}

/** A table's ring: each seat with who sits there, H when it is held for a waitlist call, or open. */
export function ringOf(table: FloorTable, seats: readonly SeatedPlayer[], held: readonly HeldSeat[]) {
  return Array.from({ length: table.seats }, (_, index) => {
    const player = seats.find((seat) => seat.seat === index + 1);
    const isHeld = held.some((seat) => seat.seat === index + 1);
    return { number: index + 1, initials: player ? initialsOf(player.fullName) : isHeld ? t('console.liveFloor.heldMark') : null };
  });
}
