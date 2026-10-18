import { describe, it, expect } from 'vitest';
import type { Outcome, Principle, Rule } from '../ontology/types.ts';
import { classifyError, type Answer, type Grade } from './classifyError.ts';
import { context, principle, resolved, scenario } from './fixtures.ts';

/**
 * Naming the mistake: the two facing-state tables, sizing, acceptable
 * alternatives, and the cross-branch "right idea, wrong spot".
 */

/** The answer as a rule outcome, leaving out a size the answer did not give. */
const outcomeOf = (answer: Answer): Outcome =>
    (answer.sizing === undefined ? { action: answer.action } : { action: answer.action, sizing: answer.sizing });

/** A rule whose only branch answers `correct`, graded against `answer`. */
const grade = (answer: Answer, correct: Answer): Grade => {
    const subject = principle({
        rule: {
            kind: 'predicate',
            situation: {},
            branches: [{ when: {}, then: outcomeOf(correct) }],
            default: { action: 'check' },
        },
    });
    return classifyError(answer, resolved(subject, scenario(), context()), scenario(), subject);
};

/** Grades `answer` against whatever `rule` resolves to on the default spot. */
const gradeWith = (rule: Rule, answer: Answer): Grade => {
    const subject: Principle = principle({ rule });
    return classifyError(answer, resolved(subject, scenario(), context()), scenario(), subject);
};

describe('classifying the answer', () => {
    it('calls an exact match correct', () => {
        expect(grade({ action: 'bet', sizing: 'medium' }, { action: 'bet', sizing: 'medium' }).klass)
            .toBe('correct');
    });

    it('grades on action alone where the source specified no size', () => {
        expect(grade({ action: 'bet', sizing: 'large' }, { action: 'bet' }).klass).toBe('correct');
    });

    it('treats an explicit "unspecified" the same way', () => {
        expect(grade({ action: 'bet', sizing: 'small' }, { action: 'bet', sizing: 'unspecified' }).klass)
            .toBe('correct');
    });

    it('calls a right action at the wrong size wrong_sizing', () => {
        expect(grade({ action: 'bet', sizing: 'small' }, { action: 'bet', sizing: 'large' }).klass)
            .toBe('wrong_sizing');
    });

    describe('facing no bet', () => {
        it('checking when the source bets is too passive', () => {
            expect(grade({ action: 'check' }, { action: 'bet' }).klass).toBe('too_passive');
        });

        it('betting when the source checks is too aggressive', () => {
            expect(grade({ action: 'bet' }, { action: 'check' }).klass).toBe('too_aggressive');
        });
    });

    describe('facing a bet', () => {
        it('folding when the source continues is too tight', () => {
            expect(grade({ action: 'fold' }, { action: 'call' }).klass).toBe('too_tight');
            expect(grade({ action: 'fold' }, { action: 'raise' }).klass).toBe('too_tight');
        });

        it('continuing when the source folds is too loose', () => {
            expect(grade({ action: 'call' }, { action: 'fold' }).klass).toBe('too_loose');
            expect(grade({ action: 'raise' }, { action: 'fold' }).klass).toBe('too_loose');
        });

        it('calling when the source raises is too passive', () => {
            expect(grade({ action: 'call' }, { action: 'raise' }).klass).toBe('too_passive');
        });

        it('raising when the source calls is too aggressive', () => {
            expect(grade({ action: 'raise' }, { action: 'call' }).klass).toBe('too_aggressive');
        });
    });

    it('falls back on aggression order for the actions the tables do not name', () => {
        expect(grade({ action: 'all_in' }, { action: 'bet' }).klass).toBe('too_aggressive');
        expect(grade({ action: 'limp' }, { action: 'raise' }).klass).toBe('too_passive');
    });

    it('treats an unanswered size as "unspecified" on both sides', () => {
        expect(grade({ action: 'bet' }, { action: 'bet', sizing: 'medium' }).klass).toBe('wrong_sizing');
        expect(grade({ action: 'bet', sizing: 'unspecified' }, { action: 'bet' }).klass).toBe('correct');
    });

    it('falls back on aggression order for facing-a-bet pairs the tables do not name', () => {
        expect(grade({ action: 'all_in' }, { action: 'call' }).klass).toBe('too_aggressive');
        expect(grade({ action: 'check' }, { action: 'raise' }).klass).toBe('too_passive');
    });
});

describe('acceptable alternatives', () => {
    const betWith = (alternatives: Outcome['acceptable_alternatives'], fallback: Outcome): Rule => ({
        kind: 'predicate',
        situation: {},
        branches: [{ when: {}, then: { action: 'bet', sizing: 'medium', acceptable_alternatives: alternatives ?? [] } }],
        default: fallback,
    });

    it('counts an acceptable alternative as correct, and flags it as secondary', () => {
        const result = gradeWith(betWith([{ action: 'check' }], { action: 'check' }), { action: 'check' });
        expect(result.correct).toBe(true);
        expect(result.secondary).toBe(true);
    });

    it('honours a size on an acceptable alternative', () => {
        const rule = betWith([{ action: 'bet', sizing: 'large' }], { action: 'check' });
        expect(gradeWith(rule, { action: 'bet', sizing: 'large' }).secondary).toBe(true);
    });

    it('skips alternatives for a different action, and accepts one with no size', () => {
        const rule = betWith(
            [{ action: 'raise', sizing: 'large' }, { action: 'check', sizing: 'unspecified' }],
            { action: 'fold' },
        );
        expect(gradeWith(rule, { action: 'check' }).secondary).toBe(true);
        expect(gradeWith(rule, { action: 'fold' }).secondary).toBe(false);
    });
});

describe('the right idea in the wrong spot', () => {
    const twoBranches = (branches: Extract<Rule, { kind: 'predicate' }>['branches']): Rule => ({
        kind: 'predicate', situation: { street: 'flop' }, branches, default: { action: 'fold' },
    });

    it('names the coordinate when one branch constrains it and the other leaves it open', () => {
        const result = gradeWith(twoBranches([
            { when: { pot_type: ['single_raised'] }, then: { action: 'bet' } },
            { when: {}, then: { action: 'check' } },
        ]), { action: 'check' });
        expect(result.klass).toBe('right_idea_wrong_spot');
        expect(result.confusedWithSlot).toBe('pot_type');
    });

    it('names the coordinate confused when another branch of the same rule wanted that answer', () => {
        const result = gradeWith(twoBranches([
            { when: { pot_type: ['single_raised'] }, then: { action: 'bet', sizing: 'medium' } },
            { when: { pot_type: ['three_bet'] }, then: { action: 'check' } },
        ]), { action: 'check' });
        expect(result.klass).toBe('right_idea_wrong_spot');
        expect(result.confusedWithSlot).toBe('pot_type');
    });

    it('does not claim confusion when two branches differ in more than one coordinate', () => {
        expect(gradeWith(twoBranches([
            { when: { pot_type: ['single_raised'] }, then: { action: 'bet' } },
            { when: { pot_type: ['three_bet'], stack_bracket: ['short'] }, then: { action: 'check' } },
        ]), { action: 'check' }).klass).toBe('too_passive');
    });

    it('does not claim confusion when two branches both wanted that answer', () => {
        expect(gradeWith(twoBranches([
            { when: { pot_type: ['single_raised'] }, then: { action: 'bet' } },
            { when: { pot_type: ['three_bet'] }, then: { action: 'check' } },
            { when: { pot_type: ['limped'] }, then: { action: 'check' } },
        ]), { action: 'check' }).klass).toBe('too_passive');
    });

    it('does not look for confusion in a range lookup, which has no branches', () => {
        const lookup: Rule = {
            kind: 'range_lookup',
            situation: {},
            range_set_id: 'rs',
            in_range: { action: 'raise' },
            out_of_range: { action: 'fold' },
        };
        expect(gradeWith(lookup, { action: 'raise' }).klass).not.toBe('right_idea_wrong_spot');
    });

    it('does not claim confusion when no branch fired at all', () => {
        const rule: Rule = {
            kind: 'predicate',
            situation: {},
            branches: [{ when: { pot_type: ['three_bet'] }, then: { action: 'check' } }],
            default: { action: 'bet' },
        };
        expect(gradeWith(rule, { action: 'check' }).klass).toBe('too_passive');
    });
});
