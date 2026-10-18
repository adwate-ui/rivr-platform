/**
 * Which mistakes a principle can ever produce, derived rather than assumed, so
 * stage 6 asks for feedback on exactly those and nothing else.
 */
import type { Outcome, Principle, Situation } from '../ontology/types.ts';
import { situationConjunction } from '../generator/slots.ts';
import { legalActionSets, reachableErrorClasses, type ErrorClass } from '../grading/classifyError.ts';

interface Answer {
    readonly outcome: Outcome;
    readonly situation: Situation;
}

/** Each outcome the principle can reach, paired with the situation that admits it. */
function answersOf(principle: Principle): Answer[] {
    const rule = principle.override_rule ?? principle.rule;
    const base = rule.situation;
    const answers: Answer[] = [];
    const at = (outcome: Outcome | undefined, situation: Situation): void => {
        if (outcome !== undefined) answers.push({ outcome, situation });
    };

    if (rule.kind === 'predicate') {
        for (const branch of rule.branches) at(branch.then, situationConjunction(base, branch.when));
        at(rule.default, base);
    } else if (rule.kind === 'range_lookup') {
        at(rule.in_range, base);
        at(rule.out_of_range, base);
    }
    for (const exception of principle.exceptions ?? []) {
        at(exception.then, situationConjunction(base, exception.when));
    }
    // A modifier's `when` constrains only game texture and stack depth, neither
    // of which changes the pad, so the base situation is the right one.
    for (const modifier of principle.modifiers ?? []) at(modifier.effect.substitute_outcome, base);
    return answers;
}

/**
 * Every mistake this principle can produce, over everything it can answer.
 *
 * Two nested unions: each outcome the principle can reach, against each pad the
 * situation admitting that outcome can put in front of the reader. Where a
 * branch narrows the situation, the narrowed one is used — a branch that only
 * fires facing a bet must not be held responsible for the mistakes available
 * when checked to.
 */
export function reachableErrors(principle: Principle): ReadonlySet<ErrorClass> {
    const rule = principle.override_rule ?? principle.rule;
    // A classify rule has no action outcomes at all, and exactly one mistake a
    // reader can make: choosing a label the source does not give here. There is
    // no too-loose or too-tight version of a reading.
    if (rule.kind === 'classify') return new Set<ErrorClass>(['wrong_label']);
    // A count is either right or off, and off has a direction.
    if (rule.kind === 'count') return new Set<ErrorClass>(['too_few', 'too_many']);

    const classes = new Set<ErrorClass>();
    for (const answer of answersOf(principle)) {
        for (const legal of legalActionSets(answer.situation)) {
            for (const klass of reachableErrorClasses(answer.outcome, legal)) classes.add(klass);
        }
    }
    return classes;
}
