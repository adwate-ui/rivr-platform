import { z } from 'zod';

/** A hand's game, as the database's hand_variant: Hold'em, PLO or a bomb pot. */
export const HAND_VARIANTS = ['holdem', 'plo', 'bomb_pot'] as const;

/** The largest pot a hand takes, in whole rupees: ₹1 crore, as log_hand checks. */
const MOST_RUPEES = 10_000_000;

/**
 * A hand as the dealer enters it on the tablet (#42): the pot in whole rupees as typed on the
 * keypad (whole ₹50 chips, up to ₹1 crore), and the game. The database checks both again.
 */
export const handEntrySchema = z.object({
  pot: z.string().regex(/^[1-9]\d{0,7}$/).refine((rupees) => Number(rupees) % 50 === 0 && Number(rupees) <= MOST_RUPEES),
  variant: z.enum(HAND_VARIANTS),
});
