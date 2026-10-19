import { z } from 'zod';
import { CHIP_PAISE } from './settings.ts';

/** A hand's game, as the database's hand_variant: Hold'em, PLO or a bomb pot. */
export const HAND_VARIANTS = ['holdem', 'plo', 'bomb_pot'] as const;

/** The largest pot a hand takes, in paise: ₹1 crore, as log_hand checks. */
const MOST_PAISE = 1_000_000_000;

/** The drop-box count at the end of a down (#44), in whole rupees as typed: whole ₹50 chips, from nothing up to ₹1 crore. */
export const dropBoxCountSchema = z.object({
  count: z.string().regex(/^(0|[1-9]\d{0,7})$/).refine((rupees) => {
    const paise = Number(rupees) * 100;
    return paise % CHIP_PAISE === 0 && paise <= MOST_PAISE;
  }),
});

/**
 * A hand as the dealer enters it on the tablet (#42): the pot in whole rupees as typed on the
 * keypad (whole ₹50 chips, up to ₹1 crore), and the game. The database checks both again.
 */
export const handEntrySchema = z.object({
  pot: z.string().regex(/^[1-9]\d{0,7}$/).refine((rupees) => {
    const paise = Number(rupees) * 100;
    return paise % CHIP_PAISE === 0 && paise <= MOST_PAISE;
  }),
  variant: z.enum(HAND_VARIANTS),
});
