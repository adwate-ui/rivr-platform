import { describe, it, expect } from 'vitest';
import { runHarness } from './quizHarness.ts';
import { aggregate, decompose } from './decompose.ts';
import { baseRates, claimVolume, triage } from './diagnostics.ts';
import { scopeGaps } from './scopeGap.ts';
import {
    aceFitRule, actionRule, countRule, fitRule, hand, payload, TOP_PAIR_OR_BETTER,
} from './answerKinds.fixtures.ts';

/**
 * The reports built from label and count results: a label row keeps its own
 * answer columns, a count has no row at all, and claims are counted within a
 * kind.
 */

const labelPass = hand('q_label_pass', { kind: 'classify', label: 'strong_fit' }, { hero_cards: ['Qh', 'Qs'], board: ['Ad', '7c', '2h'] });

const report = () => {
    const principles = [actionRule, fitRule, aceFitRule, countRule()];
    const hands = [
        hand('q_action', { action: 'bet', sizing: 'medium' }),
        // 8-8 under a jack is in none of the strong classes, so the rule reads weak.
        hand('q_label_fail', { kind: 'classify', label: 'strong_fit' }, { hero_cards: ['8h', '8s'], board: ['Jd', '7c', '2h'] }),
        labelPass,
        hand('q_count', { kind: 'count', value: TOP_PAIR_OR_BETTER }),
    ];
    const built = payload(principles, hands);
    return { built, result: runHarness(built) };
};

describe('the reports built from those results', () => {
    it('gives a label row its answer columns, and a count no row at all', () => {
        const { built, result } = report();
        const rows = decompose(result, built);
        expect(rows.map((row) => row.quiz_hand_id)).toEqual(['q_action', 'q_label_fail', 'q_label_pass']);
        expect(rows[0]).not.toHaveProperty('answer_kind');
        expect(rows[1]).toMatchObject({
            outcome: 'fail',
            expected_action: null,
            answer_kind: 'classify',
            expected_answer: 'label:strong_fit',
            actual_answer: 'label:weak_fit',
        });
        // The ace-high hand had a runner-up that disagreed; the agreement
        // figure compares it with the label, not with a missing action.
        expect(rows[2]).toMatchObject({ runner_up_would_have_answered: 'label:weak_fit', actual_answer: 'label:strong_fit' });
        expect(aggregate(rows)).toMatchObject({ matched: 3, correct: 2, handsWithRunnerUp: 1, runnerUpAgreed: 0 });
    });

    it('keeps a label hand nothing covered, with no answer where the engine gave none', () => {
        const built = payload([aceFitRule], [hand('q_uncovered', { kind: 'classify', label: 'strong_fit' })]);
        expect(decompose(runHarness(built), built)).toEqual([expect.objectContaining({
            outcome: 'unmatched',
            answer_kind: 'classify',
            expected_answer: 'label:strong_fit',
            actual_answer: null,
            nearest_principle_id: 'pr_ace_fit',
        })]);
    });

    it('agrees with a label runner-up that said the same', () => {
        const { built } = report();
        const agreeing = { ...aceFitRule, id: 'pr_ace_fit_2' };
        const result = runHarness({ ...built, principles: [aceFitRule, agreeing], quiz_hands: [labelPass] });
        expect(aggregate(decompose(result, built))).toMatchObject({ handsWithRunnerUp: 1, runnerUpAgreed: 1 });
    });

    it('counts claims within a kind: an action hand is no claim on a label rule', () => {
        const { built } = report();
        const volume = new Map(claimVolume(built).map((entry) => [entry.principleId, entry]));
        expect(volume.get('pr_bet_everything')).toMatchObject({ handsClaimed: 1, handsGoverned: 1 });
        expect(volume.get('pr_fit')).toMatchObject({ handsClaimed: 2, handsGoverned: 1 });
        expect(volume.get('pr_ace_fit')).toMatchObject({ handsClaimed: 1, handsGoverned: 1 });
        expect(volume.get('pr_top_pair_or_better')).toMatchObject({ handsClaimed: 1, handsGoverned: 1 });
    });

    it('floors the action pad on action hands only', () => {
        expect(baseRates(report().built).actionCounts).toEqual([{ action: 'bet', hands: 1 }]);
    });

    it('leaves a wrong label out of the action triage', () => {
        const { built, result } = report();
        expect(result.results.find((entry) => entry.quizId === 'q_label_fail')?.verdict).toBe('fail');
        expect(triage(result, built)).toEqual([]);
    });

    it('writes a label or a count into the scope-gap list the way it was answered', () => {
        const { built, result } = report();
        const gaps = new Map(scopeGaps(result, built).map((gap) => [gap.principleId, gap]));
        expect(gaps.get('pr_fit')?.hands).toEqual([expect.objectContaining({
            quizId: 'q_label_fail', expected: 'label:strong_fit', actual: 'label:weak_fit', answeredBy: 'default',
        })]);
        const count = `count:${TOP_PAIR_OR_BETTER}`;
        expect(gaps.get('pr_top_pair_or_better')?.hands).toEqual([expect.objectContaining({
            quizId: 'q_count', expected: count, actual: count, answeredBy: 'computed',
        })]);
    });
});
