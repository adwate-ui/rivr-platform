import { describe, it, expect } from 'vitest';
import { answerKindOfAnswer } from '../ontology/types.ts';
import { runHarness, scenarioFromQuizHand } from './quizHarness.ts';
import {
    aceFitRule, actionRule, countRule, fitRule, hand, heroless, LIVE_COMBOS, payload, TOP_PAIR_OR_BETTER,
} from './answerKinds.fixtures.ts';

/**
 * Quiz hands whose source gave a label or a number (1.9, 2.0).
 *
 * The count fixture is an invented range on an invented flop, counted by hand
 * in `answerKindFixtures.ts`. The label fixtures are synthetic: what is under
 * test is which rule is asked and how the answer is kept, not whether the
 * reading is good poker.
 *
 * What these pin, because each is easy to get wrong silently:
 *  - a label is checked against the rules that give labels, never against a
 *    more specific action rule that fits the same spot;
 *  - a count is scored, on its own line, and is in NO rate;
 *  - a count may be asked with no hero hand, and is refused rather than
 *    miscounted when the rule needs one.
 */

const COUNT = `count:${TOP_PAIR_OR_BETTER}`;

describe('which kind of question a hand answers', () => {
    it('is read off the answer, and an answer with no kind is an action', () => {
        expect(answerKindOfAnswer({ action: 'bet' })).toBe('action');
        expect(answerKindOfAnswer({ kind: 'classify', label: 'strong_fit' })).toBe('classify');
        expect(answerKindOfAnswer({ kind: 'count', value: 21 })).toBe('count');
        // An indeterminate hand may have none; it is scored as nothing anyway.
        expect(answerKindOfAnswer(undefined)).toBe('action');
    });
});

describe('a hand the source answered with a label', () => {
    it('is checked against the label rules, never against an action rule that fits better', () => {
        const report = runHarness(payload([actionRule, fitRule], [
            hand('q_label', { kind: 'classify', label: 'strong_fit' }),
        ]));
        expect(report.results[0]).toMatchObject({
            verdict: 'pass',
            answerKind: 'classify',
            principleId: 'pr_fit',
            expectedKey: 'label:strong_fit',
            actualKey: 'label:strong_fit',
        });
        // The action fields are the action record, and a label hand has none.
        expect(report.results[0]?.expected).toBeUndefined();
    });

    it('fails on the wrong label, and counts in the rate like an action does', () => {
        const report = runHarness(payload([fitRule], [
            hand('q_wrong', { kind: 'classify', label: 'weak_fit' }),
            hand('q_right', { kind: 'classify', label: 'strong_fit' }),
        ]));
        expect(report.results.map((result) => result.verdict)).toEqual(['fail', 'pass']);
        expect(report).toMatchObject({ scored: 2, passRate: 0.5, counts: null });
        expect(report.failuresByPrinciple).toEqual([{ principleId: 'pr_fit', quizIds: ['q_wrong'] }]);
    });

    it('reports what the runner-up would have said, in the same spelling', () => {
        // Q-Q on an ace-high flop: underpair. The general rule reads weak, the
        // ace-high rule strong; the narrower one wins and the other is the runner-up.
        const report = runHarness(payload([fitRule, aceFitRule], [
            hand('q_ace', { kind: 'classify', label: 'strong_fit' }, { hero_cards: ['Qh', 'Qs'], board: ['Ad', '7c', '2h'] }),
        ]));
        expect(report.results[0]).toMatchObject({
            principleId: 'pr_ace_fit', runnerUpId: 'pr_fit', runnerUpKey: 'label:weak_fit',
        });
    });

    it('names the nearest LABEL rule when none claims it, not the nearest rule of any kind', () => {
        const report = runHarness(payload([actionRule, aceFitRule], [
            hand('q_uncovered', { kind: 'classify', label: 'strong_fit' }),
        ]));
        expect(report.results[0]).toMatchObject({ verdict: 'no-principle', answerKind: 'classify', expectedKey: 'label:strong_fit' });
        expect(report.results[0]?.nearestMiss?.principleId).toBe('pr_ace_fit');
    });

    it('still needs the two cards the question is about', () => {
        const report = runHarness(payload([fitRule], [
            heroless(hand('q_no_cards', { kind: 'classify', label: 'strong_fit' })),
        ]));
        expect(report.results[0]).toMatchObject({ verdict: 'unusable', answerKind: 'classify' });
        expect(report.scored).toBe(1);
    });
});

describe('a hand the source answered with a number', () => {
    it('reproduces the number counted by hand, and keeps the working', () => {
        const report = runHarness(payload([countRule()], [hand('q_count', { kind: 'count', value: TOP_PAIR_OR_BETTER })]));
        expect(report.results[0]).toMatchObject({
            verdict: 'pass', answerKind: 'count', expectedKey: COUNT, actualKey: COUNT,
        });
        expect(report.results[0]?.counted).toMatchObject({ value: TOP_PAIR_OR_BETTER, of: LIVE_COMBOS });
    });

    it('is in no rate, and on its own line', () => {
        const report = runHarness(payload([countRule(), fitRule], [
            hand('q_count', { kind: 'count', value: TOP_PAIR_OR_BETTER }),
            hand('q_label', { kind: 'classify', label: 'weak_fit' }),
        ]));
        // One scored hand, the label, and it failed: a count pass lifting that
        // to 50% would be the arithmetic flattering the rules.
        expect(report).toMatchObject({ scored: 1, passRate: 0 });
        expect(report.counts).toEqual({ scored: 1, matched: 1, reproduced: 1, outOfSample: null });
        expect(report.byProvenance.reduce((sum, bucket) => sum + bucket.scored, 0)).toBe(1);
    });

    it('is exact unless the source itself hedged, and the hedge is the hand\'s', () => {
        const short = TOP_PAIR_OR_BETTER - 2;
        const report = runHarness(payload([countRule({ tolerance: 5 })], [
            hand('q_exact_off', { kind: 'count', value: short }),
            hand('q_about', { kind: 'count', value: short, tolerance: 2 }),
            hand('q_about_short', { kind: 'count', value: short - 1, tolerance: 2 }),
        ]));
        // The RULE's tolerance is what a reader is graded to, and plays no part.
        expect(report.results.map((result) => result.verdict)).toEqual(['fail', 'pass', 'fail']);
        expect(report.counts).toMatchObject({ scored: 3, matched: 3, reproduced: 1 });
    });

    it('may be asked with no hero hand when the rule does not remove one', () => {
        const report = runHarness(payload([countRule()], [
            heroless(hand('q_heroless', { kind: 'count', value: TOP_PAIR_OR_BETTER })),
        ]));
        expect(report.results[0]).toMatchObject({ verdict: 'pass', actualKey: COUNT });
    });

    it('is refused, not miscounted, when the rule removes a hero hand nobody named', () => {
        const report = runHarness(payload([countRule({ dead_cards: 'hero' })], [
            heroless(hand('q_heroless', { kind: 'count', value: TOP_PAIR_OR_BETTER })),
        ]));
        expect(report.results[0]).toMatchObject({ verdict: 'unusable', answerKind: 'count', principleId: 'pr_top_pair_or_better' });
        expect(report.results[0]?.note).toContain('removes the hero\'s cards');
        expect(report.counts).toEqual({ scored: 1, matched: 0, reproduced: 0, outOfSample: null });
    });

    it('splits out the counts no rule was written from', () => {
        const report = runHarness(payload([countRule()], [
            hand('q_in', { kind: 'count', value: TOP_PAIR_OR_BETTER }, {}, { provenance: { kind: 'worked_example', form: 'literal' } }),
            hand('q_held', { kind: 'count', value: TOP_PAIR_OR_BETTER - 1 }, {}, { provenance: { kind: 'held_out', form: 'literal' } }),
            // Unreadable (one card): scored, unmatched, and still not in the rate.
            hand('q_bad', { kind: 'count', value: TOP_PAIR_OR_BETTER }, { hero_cards: ['Ah'] },
                { provenance: { kind: 'probe', form: 'literal' } }),
        ]));
        expect(report.counts).toEqual({
            scored: 3, matched: 2, reproduced: 1, outOfSample: { scored: 2, matched: 1, reproduced: 0 },
        });
        expect(report.results[2]).toMatchObject({ verdict: 'unusable', answerKind: 'count' });
        expect(report).toMatchObject({ scored: 0, outOfSample: null });
    });

    it('keeps an indeterminate count out of everything, as it does any other', () => {
        const report = runHarness(payload([countRule()], [
            hand('q_estimated', { kind: 'count', value: 5 }, {}, {
                indeterminate: true,
                indeterminate_reason: 'The source estimates this number rather than counting it.',
            }),
        ]));
        expect(report.results[0]).toMatchObject({ verdict: 'indeterminate', answerKind: 'count', expectedKey: 'count:5' });
        expect(report.counts).toBeNull();
    });
});

describe('reading a heroless count hand', () => {
    it('leaves every hand coordinate unstated, and pairs no card nobody named', () => {
        // Both the turn and the river pair the board; neither pairs a hero card.
        const quiz = heroless(hand('q', { kind: 'count', value: 0 }, { board: ['Qs', '8h', '3c', '3d', '8s'] }));
        const scenario = scenarioFromQuizHand(quiz);
        expect(scenario).not.toBeNull();
        expect(scenario?.hole).toEqual([]);
        expect(scenario?.handClass).toBeUndefined();
        expect(scenario?.draws).toBeUndefined();
        expect(scenario?.relativeStrength).toBeUndefined();
        expect(scenario?.runouts).not.toContain('pairs_hero');
        expect(scenario?.priorRunouts).not.toContain('pairs_hero');
        expect(scenario?.runouts).toContain('pairs_board');
    });

    it('is unreadable for any other kind of question', () => {
        expect(scenarioFromQuizHand(heroless(hand('q', { action: 'bet' })))).toBeNull();
    });
});
