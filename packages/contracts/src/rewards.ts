import { z } from 'zod';
import { REWARD_KINDS } from './rewardKinds.ts';

export { REWARD_KINDS, type RewardKind } from './rewardKinds.ts';

/**
 * A reward as the console keeps it: its kind, its name, where and how to collect it, its price and, if only so
 * many may be redeemed, how many are left; blank is no limit. The price is whole points (1 to 1,00,00,000), or for a
 * hotel night whole nights (1 to 1,000; decision 0246).
 */
export const rewardItemSchema = z
  .object({
    kind: z.enum(REWARD_KINDS),
    name: z.string().trim().min(1).max(80),
    detail: z.string().trim().min(1).max(200),
    price: z.string().trim().regex(/^[1-9][0-9]{0,7}$/).transform(Number).pipe(z.int().min(1).max(10_000_000)),
    stock: z.string().trim().regex(/^[0-9]{0,6}$/).transform((text) => (text === '' ? null : Number(text))),
    isLive: z.boolean(),
  })
  .refine((item) => item.kind !== 'hotel_night' || item.price <= 1_000, { path: ['price'], message: 'too_many_nights' });

const MONTH = /^[0-9]{4}-(0[1-9]|1[0-2])$/;

/** A RIVR League season (#147): a name, and its first and last months as `2026-11`, the last not before the first. */
export const leagueSeasonSchema = z
  .object({
    name: z.string().trim().min(1).max(80),
    firstMonth: z.string().regex(MONTH),
    lastMonth: z.string().regex(MONTH),
  })
  .refine((season) => season.lastMonth >= season.firstMonth, { path: ['lastMonth'], message: 'before_first' });
