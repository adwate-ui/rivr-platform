import { z } from 'zod';
import { indianMobileSchema } from './identity.ts';

/** The most other players a table deals in besides the loser and the winner. */
const MOST_OTHERS = 9;

/**
 * A bad beat as the floor records it on the console (#48): the table, the loser's and the winner's
 * mobile numbers, and the other players dealt in, one number per line or separated by commas. Every
 * number is a different player; the database checks each is a member of the venue.
 */
export const badBeatSchema = z
  .object({
    tableId: z.uuid(),
    loserPhone: indianMobileSchema,
    winnerPhone: indianMobileSchema,
    otherPhones: z
      .string()
      .transform((text) => text.split(/[,\n]+/).map((phone) => phone.trim()).filter((phone) => phone !== ''))
      .pipe(z.array(indianMobileSchema).max(MOST_OTHERS)),
  })
  .refine((beat) => new Set([beat.loserPhone, beat.winnerPhone, ...beat.otherPhones]).size === beat.otherPhones.length + 2, {
    path: ['otherPhones'],
  });

/** Why a payout is reversed, in a few words. */
export const jackpotReversalSchema = z.object({ reason: z.string().trim().min(3).max(300) });
