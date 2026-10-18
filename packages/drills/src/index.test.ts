import { describe, it, expect } from 'vitest';
import example from '../fixtures/example-encoding.json' with { type: 'json' };
import {
    effectiveRule, expandRangeSets, explain, generateScenario, gradeAnswer, gradeFor, newCard, payloadOrThrow,
    rangeSideFor, resolveGoverningAny, review, validateSource, type Principle,
} from './index.ts';

/**
 * The public surface, end to end, the way a Learn screen uses it: validate an
 * uploaded encoding, deal a spot, grade an answer, explain it, and schedule the
 * principle. Each step's own behaviour is tested beside its module; this pins
 * that the steps fit together through the package's one entry point.
 */

const payload = payloadOrThrow(example);
const ranges = expandRangeSets(payload.range_sets);

function principleById(id: string): Principle {
    const principle = payload.principles.find((candidate) => candidate.id === id);
    if (principle === undefined) throw new Error(`No principle ${id} in the fixture`);
    return principle;
}

describe('the public surface', () => {
    it('accepts the fixture encoding', () => {
        expect(validateSource(example).ok).toBe(true);
    });

    it('deals, grades, explains and schedules one spot', () => {
        const principle = principleById('pr_btn_rfi');
        const { rule } = effectiveRule(principle);
        const range = rule.kind === 'range_lookup' ? ranges.get(rule.range_set_id) : undefined;
        const dealt = generateScenario(rule, { seed: 11, range, rangeSide: rangeSideFor(rule, 11) });
        if (!dealt.ok) throw new Error(`no spot: ${dealt.reason}`);

        const resolution = resolveGoverningAny(principle, dealt.scenario, { ranges });
        if (resolution.kind !== 'action') throw new Error('the opening rule answers with an action');
        const grade = gradeAnswer({ kind: 'action', answer: resolution.outcome }, resolution, dealt.scenario, principle);
        expect(grade.correct).toBe(true);
        expect(explain(principle, grade, resolution).authored).toBe(true);

        const now = Date.UTC(2026, 10, 15);
        const next = review({ card: newCard(principle.id), grade: gradeFor({ errorClass: grade.klass, fast: false }), now });
        expect(next.card.reps).toBe(1);
        expect(next.card.dueAt).toBeGreaterThan(now);
    });
});
