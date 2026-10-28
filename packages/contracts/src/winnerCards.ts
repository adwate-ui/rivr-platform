import { z } from 'zod';

/** What a winner card celebrates (#155). */
export const WINNER_CARD_KINDS = ['tournament', 'high_hand', 'jackpot'] as const;

/** A card the nightly job draws, as public.winner_cards_to_draw gives it: who, where, what, the prize and when. */
export const winnerCardRowSchema = z.object({
  card_id: z.uuid(),
  venue_id: z.uuid(),
  kind: z.enum(WINNER_CARD_KINDS),
  player_name: z.string(),
  venue_address: z.string(),
  details: z.record(z.string(), z.unknown()),
  prize_paise: z.int().min(0),
  won_at: z.string(),
});

/** A card to draw. */
export type WinnerCardRow = z.infer<typeof winnerCardRowSchema>;

/** The cards to draw tonight. */
export const winnerCardRowsSchema = z.array(winnerCardRowSchema);

/** Drawn cards no card names any more, to remove. */
export const winnerCardImagesSchema = z.array(z.object({ name: z.string() }));
