import { HIGH_HAND_CATEGORIES, HIGH_HAND_RANKS, type WinnerCardRow } from '@rivr/contracts';
import { t } from '@rivr/i18n';
import { tokens } from '@rivr/tokens';
import { renderToPng } from './render.ts';
import type { TemplateProps } from './templates/index.ts';

/** A high hand by its name on the TV: `Straight flush`, or `Four of a kind, Aces`. */
function handName(details: WinnerCardRow['details']): string {
  const category = HIGH_HAND_CATEGORIES.find((known) => known === details.category) ?? 'four_of_a_kind';
  const rank = HIGH_HAND_RANKS.find((known) => known === details.rank);
  const name = t(`tv.highHand.${category}`);
  return rank === undefined ? name : `${name}, ${t(`tv.ranks.${rank}`)}`;
}

/** The text of a detail, or nothing. */
const text = (value: unknown): string => (typeof value === 'string' ? value : '');

/** A high hand's card: the hand, the player, the table, the payout, where and when. */
export function highHandCardProps(row: WinnerCardRow): TemplateProps<'social.highHandCard'> {
  return {
    hand: handName(row.details), playerName: row.player_name, tableName: text(row.details.table_name), bonusPaise: BigInt(row.prize_paise),
    at: row.won_at, venue: row.venue_address,
  };
}

/** A tournament's or a jackpot's card: the player, what they won, the prize, when and where. */
export function winnerCardProps(row: WinnerCardRow): TemplateProps<'social.winnerCard'> {
  const eventName = row.kind === 'jackpot' ? t('social.winner.badBeatJackpot') : text(row.details.event_name);
  return { playerName: row.player_name, eventName, prizePaise: BigInt(row.prize_paise), wonAt: row.won_at, venue: row.venue_address };
}

/** A winner card (#155) as a feed post, 4:5: the high-hand card for a high hand, the winner card for the rest. */
export async function drawWinnerCard(row: WinnerCardRow): Promise<Uint8Array<ArrayBuffer>> {
  const { width, height } = tokens.viewport.feed;
  const png = row.kind === 'high_hand'
    ? await renderToPng({ template: 'social.highHandCard', props: highHandCardProps(row), width, height })
    : await renderToPng({ template: 'social.winnerCard', props: winnerCardProps(row), width, height });
  return new Uint8Array(png);
}
