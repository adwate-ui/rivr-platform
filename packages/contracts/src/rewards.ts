import { z } from 'zod';

/** What the rewards catalogue offers (#145), as public.reward_item checks them: never cash (decision 0181). */
export const REWARD_KINDS = ['tournament_seat', 'fnb_upgrade', 'merchandise', 'hotel_night'] as const;
export type RewardKind = (typeof REWARD_KINDS)[number];

/**
 * A reward as the console keeps it: its kind, its name, where and how to collect it, its price in whole
 * points (1 to 1,00,00,000) and, if only so many may be redeemed, how many are left; blank is no limit.
 */
export const rewardItemSchema = z.object({
  kind: z.enum(REWARD_KINDS),
  name: z.string().trim().min(1).max(80),
  detail: z.string().trim().min(1).max(200),
  points: z.string().trim().regex(/^[1-9][0-9]{0,7}$/).transform(Number).pipe(z.int().min(1).max(10_000_000)),
  stock: z.string().trim().regex(/^[0-9]{0,6}$/).transform((text) => (text === '' ? null : Number(text))),
  isLive: z.boolean(),
});

const MONTH = /^[0-9]{4}-(0[1-9]|1[0-2])$/;

/** A RIVR League season (#147): a name, and its first and last months as `2026-11`, the last not before the first. */
export const leagueSeasonSchema = z
  .object({
    name: z.string().trim().min(1).max(80),
    firstMonth: z.string().regex(MONTH),
    lastMonth: z.string().regex(MONTH),
  })
  .refine((season) => season.lastMonth >= season.firstMonth, { path: ['lastMonth'], message: 'before_first' });
