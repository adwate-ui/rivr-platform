import { z } from 'zod';

/**
 * A new tournament as the console's panel takes it (redesign RD-26, issue 969): its name, its start as an IST day and
 * 24-hour time, and its game. No buy-in, stake or prize: strict, so none is ever sent.
 */
export const newTournamentSchema = z.strictObject({
  name: z.string().trim().min(1).max(80),
  day: z.iso.date(),
  time: z.string().trim().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  game: z.string().trim().min(1).max(40),
});

/** A moment as its IST day (`2026-11-15`) and 24-hour time (`16:00`), for a form that edits it. */
export function istParts(at: Date): { readonly day: string; readonly time: string } {
  const shifted = new Date(at.getTime() + 330 * 60_000).toISOString();
  return { day: shifted.slice(0, 10), time: shifted.slice(11, 16) };
}

/** An IST day (`2026-11-15`) and 24-hour time (`16:00`) as the moment it is. IST keeps no daylight saving. */
export function istMoment(day: string, time: string): Date {
  return new Date(`${day}T${time}:00+05:30`);
}
