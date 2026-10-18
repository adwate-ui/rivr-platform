import { describe, it, expect } from 'vitest';
import type { OntologyPayload, Principle, QuizHand } from '../ontology/types.ts';
import {
    runHarness, scenarioFromQuizHand, admittingPrinciples, heldOutPrincipleIds, mayActivate, DEFAULT_THRESHOLD,
} from './quizHarness.ts';
import { betPrinciple, fixturePayload, FLOP_HAND, quizHand, readSpot, withoutQuizHands } from './fixtures.ts';

/**
 * The quiz harness: reading, scoring and holding out.
 *
 * Fixtures here are deliberately minimal and synthetic. The harness's job is
 * mechanical (does the encoding reproduce a stated answer?), so the tests
 * exercise the mechanism rather than any particular strategy.
 */

const principle = (over: Partial<Principle> = {}): Principle =>
    betPrinciple('pr_always_bet', { street: 'flop' }, { name: 'Always bet', ...over });

const quiz = (over: Partial<QuizHand> = {}): QuizHand => quizHand('q1', FLOP_HAND, over);

const payload = (over: Partial<OntologyPayload> = {}): OntologyPayload =>
    fixturePayload({ principles: [principle()], quiz_hands: [quiz()], ...over });

const heroOnly = { hero_cards: ['Ah', 'Kd'] };

describe('reading a stated spot', () => {
    it('works out the street from how many board cards there are', () => {
        expect(scenarioFromQuizHand(quiz({ situation_instance: heroOnly }))?.street).toBe('preflop');
        expect(scenarioFromQuizHand(quiz())?.street).toBe('flop');
        expect(scenarioFromQuizHand(quiz({
            situation_instance: { hero_cards: ['Ah', 'Kd'], board: ['Qs', '7c', '2d', '9h'] },
        }))?.street).toBe('turn');
        expect(scenarioFromQuizHand(quiz({
            situation_instance: { hero_cards: ['Ah', 'Kd'], board: ['Qs', '7c', '2d', '9h', '3s'] },
        }))?.street).toBe('river');
    });

    it('classifies the hand and board it was given', () => {
        const scenario = readSpot(quiz());
        expect(scenario.handClass).toBeDefined();
        expect(scenario.relativeStrength).toBeDefined();
        expect(scenario.boardTags.length).toBeGreaterThan(0);
    });

    it('leaves postflop classification off a preflop spot', () => {
        const scenario = scenarioFromQuizHand(quiz({ situation_instance: heroOnly }));
        expect(scenario?.handClass).toBeUndefined();
        expect(scenario?.boardTags).toEqual([]);
    });

    it('carries the stated position and action log', () => {
        const scenario = scenarioFromQuizHand(quiz({
            situation_instance: { hero_cards: ['Ah', 'Kd'], hero_position: 'CO', action_log: ['co_raise'] },
        }));
        expect(scenario?.heroPosition).toBe('CO');
        expect(scenario?.nodePath).toEqual(['co_raise']);
    });

    it('refuses a spot it cannot read rather than guessing at it', () => {
        expect(scenarioFromQuizHand(quiz({ situation_instance: { hero_cards: ['Ah'] } }))).toBeNull();
        expect(scenarioFromQuizHand(quiz({
            situation_instance: { hero_cards: ['Ah', 'Kd'], board: ['Qs', '7c'] },
        }))).toBeNull();
        // No hole cards stated at all, and a hole card that is not a card.
        expect(scenarioFromQuizHand(quiz({ situation_instance: {} }))).toBeNull();
        expect(scenarioFromQuizHand(quiz({ situation_instance: { hero_cards: ['Ah', 'Zx'] } }))).toBeNull();
    });
});

describe('finding a principle for the spot', () => {
    it('returns every principle that admits it, in declaration order', () => {
        const admitting = admittingPrinciples(readSpot(quiz()), [
            principle({ id: 'a' }),
            principle({ id: 'b', rule: { kind: 'predicate', situation: { street: 'river' }, branches: [], default: { action: 'check' } } }),
            principle({ id: 'c' }),
        ]);
        expect(admitting.map((p) => p.id)).toEqual(['a', 'c']);
    });

    it('returns nothing when the source does not cover the spot', () => {
        expect(admittingPrinciples(readSpot(quiz()), [])).toEqual([]);
    });
});

describe('scoring', () => {
    it('passes a hand the encoding answers the way the source did', () => {
        const report = runHarness(payload());
        expect(report.results[0]?.verdict).toBe('pass');
        expect(report.passRate).toBe(1);
        expect(report.meetsThreshold).toBe(true);
    });

    it('fails one it answers differently, and records both answers', () => {
        const report = runHarness(payload({ quiz_hands: [quiz({ author_answer: { action: 'check' } })] }));
        expect(report.results[0]?.verdict).toBe('fail');
        expect(report.results[0]?.expected?.action).toBe('check');
        expect(report.results[0]?.actual?.action).toBe('bet');
    });

    it('accepts an answer that matches the action where the source stated no size', () => {
        const report = runHarness(payload({ quiz_hands: [quiz({ author_answer: { action: 'bet' } })] }));
        expect(report.results[0]?.verdict).toBe('pass');
    });

    it('fails a size mismatch where the source did state one', () => {
        const report = runHarness(payload({ quiz_hands: [quiz({ author_answer: { action: 'bet', sizing: 'small' } })] }));
        expect(report.results[0]?.verdict).toBe('fail');
    });

    it('excludes an indeterminate hand from the rate entirely', () => {
        const report = runHarness(payload({
            quiz_hands: [quiz(), quizHand('q2', FLOP_HAND, { indeterminate: true, author_answer: { action: 'check' } })],
        }));
        expect(report.scored).toBe(1);
        expect(report.passRate).toBe(1);
        expect(report.results[1]?.verdict).toBe('indeterminate');
    });

    it('counts a spot no principle covers against the rate', () => {
        // Otherwise a source could improve its score by covering less.
        const report = runHarness(payload({ principles: [] }));
        expect(report.results[0]?.verdict).toBe('no-principle');
        expect(report.passRate).toBe(0);
        expect(report.meetsThreshold).toBe(false);
    });

    it('counts an unreadable hand against the rate too', () => {
        const report = runHarness(payload({ quiz_hands: [quiz({ situation_instance: { hero_cards: ['Ah'] } })] }));
        expect(report.results[0]?.verdict).toBe('unusable');
        expect(report.passRate).toBe(0);
    });

    it('groups failures by the principle that produced them', () => {
        const report = runHarness(payload({
            quiz_hands: [
                quiz({ author_answer: { action: 'check' } }),
                quizHand('q2', FLOP_HAND, { author_answer: { action: 'fold' } }),
            ],
        }));
        expect(report.failuresByPrinciple).toEqual([{ principleId: 'pr_always_bet', quizIds: ['q1', 'q2'] }]);
    });

    it('takes the threshold from the source, falling back to a documented default', () => {
        expect(runHarness(payload()).threshold).toBe(0.85);
        expect(runHarness(payload({
            source: { id: 'src', title: 'Fixture', kind: 'personal_notes' },
        })).threshold).toBe(DEFAULT_THRESHOLD);
    });

    it('holds a source below its own threshold back from activating', () => {
        const report = runHarness(payload({
            source: { id: 'src', title: 'Fixture', kind: 'personal_notes', quiz_pass_threshold: 1 },
            quiz_hands: [quiz(), quizHand('q2', FLOP_HAND, { author_answer: { action: 'check' } })],
        }));
        expect(report.passRate).toBe(0.5);
        expect(mayActivate(report)).toBe(false);
    });

    it('treats a source with no quiz hands as passing, with nothing scored', () => {
        const report = runHarness(payload({ quiz_hands: [] }));
        expect(report.scored).toBe(0);
        expect(report.passRate).toBe(1);
        expect(mayActivate(report)).toBe(true);
    });

    it('treats an absent quiz_hands array the same way', () => {
        expect(runHarness(withoutQuizHands(payload())).scored).toBe(0);
    });
});

describe('holding quiz hands out of the drill pool', () => {
    it('names every principle a quiz hand landed on', () => {
        expect(heldOutPrincipleIds(runHarness(payload()))).toEqual(new Set(['pr_always_bet']));
    });

    it('names nothing when no principle claimed any hand', () => {
        expect(heldOutPrincipleIds(runHarness(payload({ principles: [] })))).toEqual(new Set());
    });
});

describe('concept principles', () => {
    it('never claims a quiz hand', () => {
        // A drillable:false rule is a placeholder with an empty situation, so it
        // matches everything and answers nothing. Left in, the first one in a
        // source silently claims and fails every hand.
        const report = runHarness(payload({
            principles: [
                principle({ id: 'concept', drillable: false, rule: { kind: 'predicate', situation: {}, branches: [], default: { action: 'check' } } }),
                principle(),
            ],
        }));
        expect(report.results[0]?.principleId).toBe('pr_always_bet');
        expect(report.results[0]?.verdict).toBe('pass');
    });

    it('is not asked for wrong-answer feedback it can never give', () => {
        const withConcept = payload({ principles: [principle({ drillable: false, feedback: { correct: 'n/a' } })] });
        expect(runHarness(withConcept)).toBeDefined();
    });
});

describe('a stated table texture reaches the modifiers', () => {
    // Until a quiz hand could state its table texture, no modifier could fire
    // under the harness and a modifier layer was unmeasurable.
    it('fires a texture-gated modifier for the hand that states the texture, and only that hand', () => {
        const modified = principle({
            modifiers: [{
                id: 'mod_loose',
                when: { game_texture: 'loose_passive' },
                effect: { substitute_outcome: { action: 'bet', sizing: 'large' } },
            }],
        });
        const report = runHarness(payload({
            principles: [modified],
            quiz_hands: [
                quizHand('q_textured', { ...FLOP_HAND, game_texture: 'loose_passive' }, {
                    author_answer: { action: 'bet', sizing: 'large' },
                }),
                quizHand('q_untextured', FLOP_HAND),
            ],
        }));
        const textured = report.results.find((result) => result.quizId === 'q_textured');
        const untextured = report.results.find((result) => result.quizId === 'q_untextured');
        expect(textured).toMatchObject({ verdict: 'pass', actual: { sizing: 'large' } });
        expect(untextured).toMatchObject({ verdict: 'pass', actual: { sizing: 'medium' } });
    });
});
