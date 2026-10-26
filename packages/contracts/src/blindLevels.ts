import { z } from 'zod';

const chips = z.int().min(0).max(1_000_000_000);

/**
 * A blind structure as the database keeps it (decision 0200), read into the shape @rivr/domain/tournament
 * runs: levels with blinds and ante in chips, and breaks, each in minutes. Apart from the console's forms
 * (./tournaments.ts), so Home and the TV carry only this.
 */
export const blindLevelsSchema = z.array(z.union([
  z.object({ kind: z.literal('level'), small_blind: chips, big_blind: chips, ante: chips, minutes: z.int() })
    .transform((row) => ({ kind: row.kind, smallBlind: row.small_blind, bigBlind: row.big_blind, ante: row.ante, minutes: row.minutes })),
  z.object({ kind: z.literal('break'), minutes: z.int() }),
]));
