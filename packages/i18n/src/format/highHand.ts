import { common } from '../catalogue/en/common.ts';
import { t } from '../translate.ts';

const { hands, ranks, highCards } = common.highHand;

/** Whether a code from the database is one of a catalogue's own, so its words can be looked up. */
function isIn<Key extends string>(names: Readonly<Record<Key, string>>, code: string | null): code is Key {
  return code !== null && Object.hasOwn(names, code);
}

/** A hand as a promotion lists it: `Royal flush`, `Aces full`, `Any full house`. A hand the catalogue does not know shows as it is. */
export function formatListedHand(hand: string): string {
  return isIn(hands, hand) ? t(`common.highHand.hands.${hand}`) : hand;
}

/** A rank as logging offers it under a hand: `Nine` for a straight flush's high card, `Jacks` for four of a kind or a full house. */
export function formatHandRank(hand: string, rank: string): string {
  if (hand === 'straight_flush' && isIn(highCards, rank)) return t(`common.highHand.highCards.${rank}`);
  return isIn(ranks, rank) ? t(`common.highHand.ranks.${rank}`) : rank;
}

/**
 * A high hand named exactly, as a payout names it (redesign RD-22): `Royal flush`, `Straight flush, Nine high`,
 * `Four Jacks`, `Kings full`, `Aces full`.
 */
export function formatHighHand(hand: string, rank: string | null): string {
  if (hand === 'straight_flush' && isIn(highCards, rank)) return t('common.highHand.hit.straightFlush', { rank: t(`common.highHand.highCards.${rank}`) });
  if (hand === 'four_of_a_kind' && isIn(ranks, rank)) return t('common.highHand.hit.fourOfAKind', { rank: t(`common.highHand.ranks.${rank}`) });
  if (hand === 'full_house' && isIn(ranks, rank)) return t('common.highHand.hit.fullHouse', { rank: t(`common.highHand.ranks.${rank}`) });
  return formatListedHand(hand);
}

/** A high hand's rules in words, in order, for a TV board or a card: only those the promotion holds, the players dealt in always. */
export function formatHighHandRules(rules: { readonly bothHoleCards: boolean; readonly shownAtShowdown: boolean; readonly minPlayersDealt: number }): string[] {
  return [
    ...(rules.bothHoleCards ? [t('common.highHand.rules.bothHoleCards')] : []),
    ...(rules.shownAtShowdown ? [t('common.highHand.rules.shownAtShowdown')] : []),
    t('common.highHand.rules.playersDealt', { count: rules.minPlayersDealt }),
  ];
}
