/**
 * Synthetic rules and hands for the label and count harness tests.
 *
 * Test-only. The count fixture is an invented range on an invented flop,
 * counted by hand below, so a pass is the arithmetic agreeing with a number
 * worked out independently rather than the counter agreeing with itself.
 */
import type {
    AuthorAnswer, ClassifyLabel, CountRule, OntologyPayload, Principle, QuizHand, SituationInstance,
} from '../ontology/types.ts';

/** Deliberately MORE specific than either label rule: if kind were not a filter, it would govern every label hand. */
export const actionRule: Principle = {
    id: 'pr_bet_everything',
    source_id: 'src',
    name: 'Bet everything',
    rule: {
        kind: 'predicate',
        situation: { street: 'flop', pot_type: ['three_bet'], player_count: ['heads_up'] },
        branches: [],
        default: { action: 'bet', sizing: 'medium' },
    },
    rationale: 'Synthetic fixture.',
    feedback: { correct: 'x', too_loose: 'x' },
};

const FIT_LABELS: ClassifyLabel[] = [{ id: 'strong_fit', label: 'Strong fit' }, { id: 'weak_fit', label: 'Weak fit' }];

export const fitRule: Principle = {
    id: 'pr_fit',
    source_id: 'src',
    name: 'Fit',
    rule: {
        kind: 'classify',
        situation: { street: 'flop' },
        labels: FIT_LABELS,
        perspective: 'villain',
        prompt: 'Strong fit or weak fit?',
        branches: [{ when: { hand_class_any: ['top_pair_good_kicker', 'overpair', 'set'] }, then: { label: 'strong_fit' } }],
        default: { label: 'weak_fit' },
    },
    rationale: 'Synthetic fixture.',
    feedback: { correct: 'x', wrong_label: 'x' },
};

/** Narrower than `fitRule`, and disagreeing with it about Q-Q under an ace, so the runner-up is load-bearing. */
export const aceFitRule: Principle = {
    ...fitRule,
    id: 'pr_ace_fit',
    rule: {
        kind: 'classify',
        situation: { street: 'flop', board_require: ['ace_high'] },
        labels: FIT_LABELS,
        perspective: 'villain',
        prompt: 'Strong fit or weak fit?',
        branches: [],
        default: { label: 'strong_fit' },
    },
};

/** The flop every hand below is dealt unless it says otherwise: queen high, rainbow. */
export const QUEEN_HIGH = ['Qs', '8h', '3c'];

/**
 * The counted range on `QUEEN_HIGH`, with the board's cards dead:
 *   KK  6 combos, none blocked, an overpair          ->  6
 *   QQ  3 of 6 combos survive the Qs, each a set     ->  3
 *   AQs 3 of 4 survive the Qs, top pair, top kicker  ->  3
 *   AJo 12 combos, none blocked, ace high, no pair   ->  0
 * Top pair or better: 6 + 3 + 3 = 12, of 6 + 3 + 3 + 12 = 24 live combos.
 */
export const COUNTED_RANGE = ['KK', 'QQ', 'AQs', 'AJo'];
export const TOP_PAIR_OR_BETTER = 12;
export const LIVE_COMBOS = 24;

/** A count rule over `COUNTED_RANGE`: how many make top pair or better. */
export const countRule = (over: Partial<CountRule> = {}): Principle => ({
    id: 'pr_top_pair_or_better',
    source_id: 'src',
    name: 'Top pair or better',
    page_ref: '12',
    rule: {
        kind: 'count',
        situation: { street: 'flop' },
        range_set_id: 'rs_counted',
        dead_cards: 'board',
        filter: { kind: 'hand_class_min', hand_class: 'top_pair_weak_kicker' },
        prompt: 'How many make top pair or better?',
        ...over,
    },
    rationale: 'Synthetic fixture.',
    feedback: { correct: 'x', too_few: 'x', too_many: 'x' },
});

/** A heads-up three-bet pot on `QUEEN_HIGH`, the hero holding A-Q of hearts (top pair, top kicker). */
export const hand = (id: string, answer: AuthorAnswer, over: Partial<SituationInstance> = {},
    extra: Partial<QuizHand> = {}): QuizHand => ({
    id,
    source_id: 'src',
    page_ref: 12,
    situation_instance: {
        hero_cards: ['Ah', 'Qh'],
        board: QUEEN_HIGH,
        pot_type: 'three_bet',
        player_count: 'heads_up',
        ...over,
    },
    author_answer: answer,
    ...extra,
});

/** The same hand with no hero cards stated at all. */
export function heroless(quiz: QuizHand): QuizHand {
    const { hero_cards: _none, ...instance } = quiz.situation_instance;
    return { ...quiz, situation_instance: instance };
}

/** A 2.0 payload holding these principles and quiz hands, with the fixture range. */
export const payload = (principles: Principle[], quizHands: QuizHand[]): OntologyPayload => ({
    ontology_version: '2.0',
    source: { id: 'src', title: 'Fixture', kind: 'personal_notes', quiz_pass_threshold: 0.5 },
    opponent_types: [],
    range_sets: [{ id: 'rs_counted', hands: COUNTED_RANGE }],
    principles,
    quiz_hands: quizHands,
});
