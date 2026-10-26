// Apart from rewards.ts, with no zod, so @rivr/db can read the list without the player's first load carrying zod.

/** What the rewards catalogue offers (#145), as public.reward_item checks them: never cash (decision 0181). */
export const REWARD_KINDS = ['tournament_seat', 'fnb_upgrade', 'merchandise', 'hotel_night'] as const;
export type RewardKind = (typeof REWARD_KINDS)[number];
