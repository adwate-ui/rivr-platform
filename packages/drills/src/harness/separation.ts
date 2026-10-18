/**
 * What tells a principle's right answers apart from its wrong ones.
 */
import type { OntologyPayload, Situation } from '../ontology/types.ts';
import type { Scenario } from '../generator/types.ts';
import { SPECIFICITY_SLOTS } from '../grading/arbitrate.ts';
import { effectiveRule } from '../grading/resolve.ts';
import { governingIdOf, handsById, principleOf, readGraded } from './gradedHand.ts';
import type { HarnessReport } from './results.ts';

export interface Separation {
    readonly principleId: string;
    readonly governed: number;
    readonly passed: number;
    readonly failed: number;
    /**
     * Coordinates whose values are DISJOINT between the hands this principle
     * gets right and the hands it gets wrong: the mechanical form of "the source
     * conditions on something the rule does not". If every pass is heads-up and
     * every failure multiway, player count is what the source was reading.
     */
    readonly separators: readonly {
        slot: string;
        onPasses: readonly string[];
        onFailures: readonly string[];
    }[];
}

interface Governed {
    readonly passes: Scenario[];
    readonly failures: Scenario[];
}

/** Every constrainable coordinate's value on this scenario, as a string. */
function coordinateValues(scenario: Scenario): Record<string, string | undefined> {
    return {
        hero_position: scenario.heroPosition,
        villain_position: scenario.villainPosition,
        pot_type: scenario.potType,
        player_count: scenario.playerCount,
        stack_bracket: scenario.stackBracket,
        spr_bracket: scenario.sprBracket,
        preflop_facing_state: scenario.preflopFacingState,
        postflop_facing_state: scenario.postflopFacingState,
        villain_raise_size: scenario.villainRaiseSize,
        villain_types: scenario.villainType,
        hand_class_any: scenario.handClass,
        draw_class_any: scenario.draws?.join('+'),
        relative_strength_any: scenario.relativeStrength,
        runout_any: scenario.runouts?.join('+'),
    };
}

/** The scenarios each principle got right and wrong. */
function groupByPrinciple(report: HarnessReport, payload: OntologyPayload): Map<string, Governed> {
    const hands = handsById(payload);
    const groups = new Map<string, Governed>();
    for (const result of report.results) {
        if (result.verdict !== 'pass' && result.verdict !== 'fail') continue;
        const { scenario } = readGraded(result, hands, payload);
        const id = governingIdOf(result);
        const group = groups.get(id) ?? { passes: [], failures: [] };
        (result.verdict === 'pass' ? group.passes : group.failures).push(scenario);
        groups.set(id, group);
    }
    return groups;
}

const valuesAt = (scenarios: readonly Scenario[], slot: string): string[] =>
    [...new Set(scenarios
        .map((scenario) => coordinateValues(scenario)[slot])
        .filter((value): value is string => value !== undefined))].sort();

const unconstrained = (situation: Situation, slot: keyof Situation): boolean => {
    const constraint = situation[slot];
    return constraint === undefined || (Array.isArray(constraint) && constraint.length === 0);
};

/**
 * Unconstrained slots whose values split passes from failures. Disjoint, and
 * populated on both sides: a coordinate no passing hand states cannot be shown
 * to be what separates them.
 */
function separatorsFor(situation: Situation, group: Governed): Separation['separators'] {
    return SPECIFICITY_SLOTS
        .filter((slot) => unconstrained(situation, slot))
        .map(String)
        .map((slot) => ({ slot, onPasses: valuesAt(group.passes, slot), onFailures: valuesAt(group.failures, slot) }))
        .filter((entry) => entry.onPasses.length > 0
            && entry.onFailures.length > 0
            && !entry.onPasses.some((value) => entry.onFailures.includes(value)));
}

/**
 * For each principle that produces failures: what tells its right answers apart
 * from its wrong ones. This turns "this rule is too broad" into a specific
 * coordinate to check against the source. A rule governing only failures gets
 * no separators, and that is itself the signal: the problem is the outcome or
 * the scope entirely, not one missing coordinate.
 */
export function separation(report: HarnessReport, payload: OntologyPayload): Separation[] {
    const principles = new Map(payload.principles.map((principle) => [principle.id, principle]));
    return [...groupByPrinciple(report, payload).entries()]
        .filter(([, group]) => group.failures.length > 0)
        .map(([principleId, group]) => ({
            principleId,
            governed: group.passes.length + group.failures.length,
            passed: group.passes.length,
            failed: group.failures.length,
            separators: separatorsFor(effectiveRule(principleOf(principles, principleId)).rule.situation, group),
        }))
        .sort((a, b) => b.failed - a.failed || a.principleId.localeCompare(b.principleId));
}
