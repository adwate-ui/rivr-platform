import { CARD_RANKS, type CardRank, type HighHand, type Reward } from '@rivr/contracts/promotionModel';
import { err, ok, type Result } from '@rivr/contracts/result';

/** A high hand promotion's reward (redesign RD-22): its hands, each with its own Bonus, and its rules. */
export type HighHandReward = Extract<Reward, { kind: 'high_hand' }>;

/** A hit as the floor logs it: the hand, its rank where the hand has one, and each rule confirmed. */
export interface HighHandHit {
  readonly hand: HighHand;
  readonly rank: CardRank | null;
  readonly confirmed: { readonly bothHoleCards: boolean; readonly shownAtShowdown: boolean; readonly playersDealt: boolean };
}

/** Why a hit pays nothing: its hand is not one the promotion lists, its rank is not one the hand has, or a rule is not confirmed. */
export type HighHandRefusal = 'hand_not_listed' | 'wrong_rank' | 'both_hole_cards_not_confirmed' | 'showdown_not_confirmed' | 'players_not_confirmed';

/** What a hit pays: the listed hand it is paid as, its rank, and that hand's Bonus in chips. */
export interface HighHandPayout {
  readonly hand: HighHand;
  readonly rank: CardRank | null;
  readonly chips: number;
}

// A straight flush's high card: king down to five. Ace high is a royal flush.
const STRAIGHT_FLUSH_HIGH: readonly CardRank[] = CARD_RANKS.slice(1, 10);

/**
 * The ranks a hand is logged with: a straight flush's high card, which four of a kind, the three of a full house. A
 * royal flush and Aces full have none.
 */
export function ranksOf(hand: HighHand): readonly CardRank[] {
  switch (hand) {
    case 'straight_flush':
      return STRAIGHT_FLUSH_HIGH;
    case 'four_of_a_kind':
    case 'full_house':
      return CARD_RANKS;
    default:
      return [];
  }
}

function hasRightRank({ hand, rank }: HighHandHit): boolean {
  const ranks = ranksOf(hand);
  return ranks.length === 0 ? rank === null : rank !== null && ranks.includes(rank);
}

/** The hands a hit can be paid as, the first listed winning: a full house of three aces is Aces full, then any full house. */
function payableAs({ hand, rank }: HighHandHit): readonly HighHand[] {
  const isAcesFull = hand === 'aces_full' || (hand === 'full_house' && rank === 'ace');
  return isAcesFull ? ['aces_full', 'full_house'] : [hand];
}

function unconfirmedRule(rules: HighHandReward['rules'], confirmed: HighHandHit['confirmed']): HighHandRefusal | null {
  if (rules.bothHoleCards && !confirmed.bothHoleCards) return 'both_hole_cards_not_confirmed';
  if (rules.shownAtShowdown && !confirmed.shownAtShowdown) return 'showdown_not_confirmed';
  return confirmed.playersDealt ? null : 'players_not_confirmed';
}

/**
 * What a high hand hit pays (redesign RD-22; the owner, 15 Nov): its listed hand's Bonus, whole, every time. A full
 * house of three aces is paid as Aces full where the promotion lists it, and as any full house otherwise. Nothing is
 * paid, and the refusal says which, for a hand the promotion does not list, a rank the hand cannot have, or a rule the
 * promotion holds left unconfirmed, the players dealt in always; the first in that order. No hourly window and no best
 * hand: the promotion's budget alone holds it (checkLimits). The database's private.high_hand_payout is proved equal on
 * promotionRewards.json.
 */
export function highHandPayout(reward: HighHandReward, hit: HighHandHit): Result<HighHandPayout, HighHandRefusal> {
  const listed = payableAs(hit).map((hand) => reward.hands.find((one) => one.hand === hand)).find((one) => one !== undefined);
  if (listed === undefined) return err('hand_not_listed');
  if (!hasRightRank(hit)) return err('wrong_rank');
  const refusal = unconfirmedRule(reward.rules, hit.confirmed);
  if (refusal !== null) return err(refusal);
  const rank = hit.hand === 'aces_full' ? 'ace' : hit.rank;
  return ok({ hand: listed.hand, rank: listed.hand === 'aces_full' ? null : rank, chips: listed.chips });
}

/** The most a promotion pays for one hand: the list shows it as "Up to 25,000 Bonus a hand". */
export function highestHandChips(reward: HighHandReward): number {
  return Math.max(...reward.hands.map((one) => one.chips));
}
