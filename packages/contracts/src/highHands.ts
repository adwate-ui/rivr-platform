import { z } from 'zod';

/** The high hands the club pays (#47), lowest first, as public.high_hand_category lists them. */
export const HIGH_HAND_CATEGORIES = ['four_of_a_kind', 'straight_flush', 'royal_flush'] as const;
export type HighHandCategory = (typeof HIGH_HAND_CATEGORIES)[number];

/** The rank of a four of a kind, highest first, as the tablet offers them and the claim keeps them. */
export const HIGH_HAND_RANKS = ['A', 'K', 'Q', 'J', 'T', '9', '8', '7', '6', '5', '4', '3', '2'] as const;
export type HighHandRank = (typeof HIGH_HAND_RANKS)[number];

/** The dealer's claim on the tablet: the category, the seat, and for four of a kind its rank. */
export const highHandClaimSchema = z
  .object({
    category: z.enum(HIGH_HAND_CATEGORIES),
    seat: z.int().min(1).max(10),
    rank: z.enum(HIGH_HAND_RANKS).nullable(),
  })
  .refine((claim) => (claim.category === 'four_of_a_kind') === (claim.rank !== null), { path: ['rank'] });

/** The floor rejects a claim, and says why. */
export const highHandRejectSchema = z.object({ reason: z.string().trim().min(3).max(300) });
