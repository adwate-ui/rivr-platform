import { ENGLISH_WORDS, type DrillSentences, type DrillWords } from '@rivr/drills';
import { t } from '@rivr/i18n';

const RANK_KEYS = { A: 'ace', K: 'king', Q: 'queen', J: 'jack', T: 'ten', 9: 'nine', 8: 'eight', 7: 'seven', 6: 'six', 5: 'five', 4: 'four', 3: 'three', 2: 'two' } as const;
const SUIT_KEYS = { h: 'hearts', d: 'diamonds', c: 'clubs', s: 'spades' } as const;
const PAST_KEYS = ['bet', 'call', 'check', 'raise', 'fold', 'limp', 'all_in', '3bet', '4bet', 'three_bet', 'four_bet'] as const;

/** Each key of an engine table read from the catalogue under `player.learn.words.<group>`. */
function fromCatalogue<K extends string>(keys: Readonly<Record<K, string>>, read: (key: K) => string): Record<K, string> {
  const words: Partial<Record<K, string>> = {};
  for (const key of Object.keys(keys).filter((each): each is K => each in keys)) words[key] = read(key);
  return { ...keys, ...words };
}

/** The sentences, with their slots, from the catalogue. */
const SENTENCES: DrillSentences = {
  card: (rank, suit) => t('player.learn.words.card', { rank, suit }),
  cards: (cards) => cards.join(t('player.learn.words.listSeparator')),
  game: (stakes) => t('player.learn.words.game', { stakes }),
  opening: ({ street, position, stack, pot, count }) => {
    if (pot !== undefined && count !== undefined) return t('player.learn.words.openingPotCount', { street, position, stack, pot, count });
    if (pot !== undefined) return t('player.learn.words.openingPot', { street, position, stack, pot });
    if (count !== undefined) return t('player.learn.words.openingCount', { street, position, stack, count });
    return t('player.learn.words.opening', { street, position, stack });
  },
  sentence: (text) => t('player.learn.words.sentence', { text }),
  middle: (amount) => t('player.learn.words.middle', { amount: `${amount.charAt(0).toUpperCase()}${amount.slice(1)}` }),
  about: (amount) => t('player.learn.words.about', { amount }),
  board: (cards) => t('player.learn.words.board', { cards }),
  runout: (street, changes) => t('player.learn.words.runout', { street, changes: changes.join(t('player.learn.words.and')) }),
  hand: (cards, isOpponents) => t(isOpponents ? 'player.learn.words.opponentHand' : 'player.learn.words.hand', { cards }),
  actions: (steps) => t('player.learn.words.actions', { steps: steps.join(t('player.learn.words.then')) }),
  step: (actor, verb) => (actor === undefined ? verb : t(actor === 'hero' ? 'player.learn.words.you' : 'player.learn.words.they', { verb })),
  stepOn: (step, street) => t('player.learn.words.stepOn', { step, street }),
};

/**
 * The drill engine's words from the catalogue (#138; decision 0016), so a spot is read aloud in the app's own words. The
 * engine's English stands only for a word the catalogue does not hold.
 */
export function drillWords(): DrillWords {
  const english = ENGLISH_WORDS;
  return {
    ranks: fromCatalogue(english.ranks, (rank) => t(`player.learn.words.ranks.${RANK_KEYS[rank]}`)),
    suits: fromCatalogue(english.suits, (suit) => t(`player.learn.words.suits.${SUIT_KEYS[suit]}`)),
    streets: fromCatalogue(english.streets, (street) => t(`player.learn.words.streets.${street}`)),
    streetWords: fromCatalogue(english.streetWords, (street) => t(`player.learn.words.streetWords.${street}`)),
    positions: fromCatalogue(english.positions, (position) => t(`player.learn.words.positions.${position}`)),
    stacks: fromCatalogue(english.stacks, (stack) => t(`player.learn.words.stacks.${stack}`)),
    spr: fromCatalogue(english.spr, (spr) => t(`player.learn.words.spr.${spr}`)),
    raiseSizes: fromCatalogue(english.raiseSizes, (size) => t(`player.learn.words.raiseSizes.${size}`)),
    pots: fromCatalogue(english.pots, (pot) => t(`player.learn.words.pots.${pot}`)),
    counts: fromCatalogue(english.counts, (count) => t(`player.learn.words.counts.${count}`)),
    preflopFacing: fromCatalogue(english.preflopFacing, (state) => t(`player.learn.words.preflopFacing.${state}`)),
    postflopFacing: fromCatalogue(english.postflopFacing, (state) => t(`player.learn.words.postflopFacing.${state}`)),
    runouts: fromCatalogue(english.runouts, (tag) => t(`player.learn.words.runouts.${tag}`)),
    past: Object.fromEntries(PAST_KEYS.map((verb) => [verb, t(`player.learn.words.past.${verb}`)])),
    say: SENTENCES,
  };
}
