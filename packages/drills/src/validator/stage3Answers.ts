/**
 * Stage 3 checks on answers: quiz hands that answer, or say why not, and the
 * label and count rules the schema cannot fully check.
 */
import type { ClassifyRule, CountRule, OntologyPayload, Principle, QuizHand } from '../ontology/types.ts';
import { CODES, type Finding } from './report.ts';

/** Every label any classify rule offers, overrides included. */
function offeredLabels(payload: OntologyPayload): ReadonlySet<string> {
    return new Set(payload.principles
        .flatMap((principle) => [principle.rule, principle.override_rule])
        .flatMap((rule) => (rule?.kind === 'classify' ? rule.labels.map((label) => label.id) : [])));
}

/** A quiz hand answered with a label no rule offers. */
function unofferedLabel(quiz: QuizHand, index: number, offered: ReadonlySet<string>): Finding[] {
    const answer = quiz.author_answer;
    if (answer === undefined || !('kind' in answer) || answer.kind !== 'classify' || offered.has(answer.label)) return [];
    return [{
        stage: 3,
        severity: 'error',
        code: CODES.UNKNOWN_LABEL,
        path: `/quiz_hands/${index}/author_answer/label`,
        objectId: quiz.id,
        message: `"${answer.label}" is not a label any classify rule in this source offers`
            + (offered.size === 0 ? ' (it has none).' : ` (${[...offered].sort().join(', ')}).`),
    }];
}

/** A scored hand with no answer, or an unscored one with no reason. */
function unanswered(quiz: QuizHand, index: number): Finding[] {
    if (quiz.indeterminate === true) {
        if ((quiz.indeterminate_reason ?? '').trim().length > 0) return [];
        return [{
            stage: 3,
            severity: 'error',
            code: CODES.UNJUSTIFIED_INDETERMINATE,
            path: `/quiz_hands/${index}/indeterminate_reason`,
            objectId: quiz.id,
            message: 'Marked indeterminate with no reason. Dropping a hand out of '
                + 'scoring needs a justification written from the source text — '
                + '"no principle got it right" is a coverage hole in disguise.',
        }];
    }
    if (quiz.author_answer !== undefined) return [];
    return [{
        stage: 3,
        severity: 'error',
        code: CODES.MISSING_AUTHOR_ANSWER,
        path: `/quiz_hands/${index}/author_answer`,
        objectId: quiz.id,
        message: 'A scored hand must record what the author said to do. Give it an '
            + 'answer, or mark it indeterminate with a reason from the passage.',
    }];
}

/**
 * Every scored hand has an answer, and every unscored hand has a reason.
 *
 * These two are one check because they are two halves of one invariant: a hand
 * either states what the author said to do, or states — in the author's own
 * terms — why they never said. The gap between them is where a hand quietly
 * stops being evidence: an answer invented for a hand the source never
 * answered gets scored as though it were the author's, and an `indeterminate`
 * flag with no reason is the laundry chute every inconvenient hand ends up in.
 *
 * A quiz hand's label is checked against every label any rule offers rather
 * than against the rule that governs it, because which rule governs is the
 * harness's finding, not a fact of the JSON — but a label no rule offers is a
 * typo, and a typo would otherwise score as a silent fail against a rule that
 * was right all along.
 */
export function answerability(payload: OntologyPayload): Finding[] {
    const offered = offeredLabels(payload);
    return (payload.quiz_hands ?? []).flatMap((quiz, index) => [
        ...unofferedLabel(quiz, index, offered),
        ...unanswered(quiz, index),
    ]);
}

/** Exceptions or modifiers on a rule whose answer they cannot change. */
function forbiddenFields(principle: Principle, at: string, explain: (field: string) => string): Finding[] {
    const present: [string, boolean][] = [
        ['exceptions', (principle.exceptions ?? []).length > 0],
        ['modifiers', (principle.modifiers ?? []).length > 0],
    ];
    return present.flatMap(([field, isPresent]): Finding[] => (!isPresent ? [] : [{
        stage: 3,
        severity: 'error',
        code: CODES.ANSWER_KIND_MISMATCH,
        path: `${at}/${field}`,
        objectId: principle.id,
        message: explain(field),
    }]));
}

/** Branch and default labels that are not among the rule's own labels. */
function unknownRuleLabels(rule: ClassifyRule, principle: Principle, at: string): Finding[] {
    const known = new Set(rule.labels.map((label) => label.id));
    const named: { path: string; label: string }[] = [
        ...rule.branches.map((branch, position) => ({
            path: `${at}/rule/branches/${position}/then/label`,
            label: branch.then.label,
        })),
        ...(rule.default === undefined ? [] : [{ path: `${at}/rule/default/label`, label: rule.default.label }]),
    ];
    return named.filter(({ label }) => !known.has(label)).map(({ path, label }): Finding => ({
        stage: 3,
        severity: 'error',
        code: CODES.UNKNOWN_LABEL,
        path,
        objectId: principle.id,
        message: `"${label}" is not one of this rule's labels (${[...known].join(', ')}). `
            + 'A rule that answers with a label nobody can choose grades every reader wrong.',
    }));
}

/** An override that changes an action rule into a classify rule. */
function kindChangingOverride(principle: Principle, at: string): Finding[] {
    if (principle.override_rule === undefined || principle.rule.kind === 'classify') return [];
    return [{
        stage: 3,
        severity: 'error',
        code: CODES.ANSWER_KIND_MISMATCH,
        path: `${at}/override_rule`,
        objectId: principle.id,
        message: 'An override must answer the same kind of question as the rule it replaces; '
            + 'this one turns an action rule into a classify rule.',
    }];
}

/**
 * The two things a classify rule can get wrong that the schema cannot see.
 *
 * The schema checks that `labels` has at least two entries and that every
 * outcome names a string. What it cannot check is whether that string is one of
 * THIS rule's labels — JSON Schema has no way to say "one of the values in a
 * sibling array" — so a branch answering a misspelt label validates cleanly and
 * then grades every reader wrong forever.
 *
 * The second is scope. Exceptions, modifiers and an override of a different
 * kind are all forbidden on a classify rule, because none of them has a
 * meaning here: an "exception" to a question with a closed list of answers is
 * its first branch, and a modifier substitutes an action outcome there is
 * nowhere to put. `resolveClassify` ignores them, and silently ignoring an
 * authored field is worse than refusing it.
 */
export function classifyVocabulary(payload: OntologyPayload): Finding[] {
    return payload.principles.flatMap((principle, index) => {
        const rule = principle.override_rule ?? principle.rule;
        if (rule.kind !== 'classify') return [];
        const at = `/principles/${index}`;
        return [
            ...unknownRuleLabels(rule, principle, at),
            ...forbiddenFields(principle, at, (field) => `A classify rule cannot carry ${field}: they answer with an action, and `
                + 'nothing here reads them. An exception to a question with a closed list of '
                + 'answers is its first branch.'),
            ...kindChangingOverride(principle, at),
        ];
    });
}

const COUNT_HAND_SLOTS = ['hand_class_any', 'draw_class_any', 'draw_class_exclude', 'relative_strength_any'] as const;

/** Hand slots a count rule reads, and a suitless bare-ace filter that may have no suit to name. */
function countScope(rule: CountRule, principle: Principle, at: string): Finding[] {
    const scoped = COUNT_HAND_SLOTS.filter((slot) => (rule.situation[slot] ?? []).length > 0).map((slot): Finding => ({
        stage: 3,
        severity: 'error',
        code: CODES.ANSWER_KIND_MISMATCH,
        path: `${at}/rule/situation/${slot}`,
        objectId: principle.id,
        message: `A count rule cannot read ${slot}: it counts a RANGE against a board, `
            + "and the hero's own cards enter only through dead_cards.",
    }));
    // "The bare ace of the suit" with no suit named means the board's flush
    // suit, which exists only where the flop is monotone. A rule that can reach
    // a flop without one would ask a question with no answer.
    const suitless = rule.filter.kind === 'bare_ace_of_suit' && rule.filter.suit === undefined
        && !(rule.situation.board_require ?? []).includes('monotone');
    return !suitless ? scoped : [...scoped, {
        stage: 3,
        severity: 'error',
        code: CODES.COUNT_SUIT_UNSTATED,
        path: `${at}/rule/filter/suit`,
        objectId: principle.id,
        message: 'bare_ace_of_suit names no suit, so the suit is the flush suit of the board — '
            + 'and only a monotone flop is sure to have one. Require `monotone`, or name the suit.',
    }];
}

/**
 * What a count rule can get wrong that the schema cannot see.
 *
 * Hand slots are the substantive one. The question is about the OPPONENT's whole
 * range against this board; the hero's own two cards enter only through
 * `dead_cards`. A count rule scoped to a hand class would be asking a range
 * question of one holding, and the generator would then vary a coordinate the
 * answer does not depend on — a drill that looks like it is testing something
 * and is not.
 *
 * Exceptions and modifiers go the same way they do for a classify rule: the
 * answer here is computed from the range and the board, so there is nothing for
 * them to substitute, and silently ignoring an authored field is worse than
 * refusing it.
 */
export function countVocabulary(payload: OntologyPayload): Finding[] {
    return payload.principles.flatMap((principle, index) => {
        const rule = principle.override_rule ?? principle.rule;
        if (rule.kind !== 'count') return [];
        const at = `/principles/${index}`;
        return [
            ...countScope(rule, principle, at),
            ...forbiddenFields(principle, at, (field) => `A count rule cannot carry ${field}: its answer is computed from the `
                + 'range and the board, and there is nothing for them to substitute.'),
        ];
    });
}
