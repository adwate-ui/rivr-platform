/**
 * Synthetic builders for the harness tests.
 *
 * Test-only. A rule that says "always bet" is not poker advice and is not meant
 * to be: the harness's job is mechanical (does the encoding reproduce a stated
 * answer?), so the fixtures exercise the mechanism rather than any strategy.
 */
import type {
    OntologyPayload, PredicateRule, Principle, QuizHand, Situation, SituationInstance,
} from '../ontology/types.ts';
import { ONTOLOGY_VERSION } from '../ontology/types.ts';
import type { Scenario } from '../generator/types.ts';
import { scenarioFromQuizHand } from './parse/quizScenario.ts';

/** A heads-up flop the hero holds A-K on, before anything else is stated. */
export const FLOP_HAND: SituationInstance = { hero_cards: ['Ah', 'Kd'], board: ['Qs', '7c', '2d'] };

/** The same hand on a turn. */
export const TURN_HAND: SituationInstance = { hero_cards: ['Ah', 'Kd'], board: ['Qs', '7c', '2d', '9h'] };

/** A branchless predicate rule over `situation` that always answers `fold`. */
export const foldRule = (situation: Situation): PredicateRule => ({
    kind: 'predicate', situation, branches: [], default: { action: 'fold' },
});

/** A principle whose rule is a branchless "bet medium" over `situation`. */
export const betPrinciple = (id: string, situation: Situation, over: Partial<Principle> = {}): Principle => ({
    id,
    source_id: 'src',
    name: id,
    rule: { kind: 'predicate', situation, branches: [], default: { action: 'bet', sizing: 'medium' } },
    rationale: 'Synthetic fixture.',
    feedback: { correct: 'x', too_loose: 'x' },
    ...over,
});

/** A quiz hand stating `instance`, whose source answers "bet medium" unless `over` says otherwise. */
export const quizHand = (id: string, instance: SituationInstance, over: Partial<QuizHand> = {}): QuizHand => ({
    id,
    source_id: 'src',
    situation_instance: instance,
    author_answer: { action: 'bet', sizing: 'medium' },
    ...over,
});

/** A payload with nothing in it but what `over` supplies. */
export const fixturePayload = (over: Partial<OntologyPayload> = {}): OntologyPayload => ({
    ontology_version: ONTOLOGY_VERSION,
    source: { id: 'src', title: 'Fixture', kind: 'personal_notes', quiz_pass_threshold: 0.85 },
    opponent_types: [],
    range_sets: [{ id: 'rs', hands: ['AA'] }],
    principles: [],
    quiz_hands: [],
    ...over,
});

/** The same payload with no `quiz_hands` array at all. */
export function withoutQuizHands(payload: OntologyPayload): OntologyPayload {
    const { quiz_hands: _omitted, ...rest } = payload;
    return rest;
}

/** The spot a fixture hand reads as. A fixture that cannot be read is a broken test. */
export function readSpot(quiz: QuizHand, source?: OntologyPayload): Scenario {
    const spot = scenarioFromQuizHand(quiz, source);
    if (spot === null) throw new Error(`Fixture hand ${quiz.id} cannot be read.`);
    return spot;
}
