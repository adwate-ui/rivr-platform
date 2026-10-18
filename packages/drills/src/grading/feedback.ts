/**
 * The sentence the user reads after answering.
 *
 * A LOOKUP, never a generation. The whole design rests on feedback being
 * authored once per principle and keyed by error type — which is exactly why it
 * covers every scenario the generator will ever produce from that rule, and
 * exactly why no model is needed at drill time.
 *
 * Where a source did not author the key that fired, the fallback is a plain
 * counterpart-neutral sentence rather than nothing. Silence after a wrong
 * answer is the one outcome that teaches the reader they cannot trust the app.
 */

import type { Feedback, Principle } from '../ontology/types.ts';
import type { ErrorClass, Grade } from './classifyError.ts';
import type { AnyResolution } from './resolve.ts';

/** Used when the principle authored no text for the key that fired. */
export const NEUTRAL_FALLBACK: Readonly<Record<ErrorClass, string>> = {
    correct: 'Right.',
    too_loose: 'This source plays a narrower hand here than the one you chose.',
    too_tight: 'This source keeps going here rather than giving up.',
    too_passive: 'This source takes the aggressive line here.',
    too_aggressive: 'This source takes the passive line here.',
    wrong_sizing: 'The action is right; the size is not the one this source uses.',
    right_idea_wrong_spot: 'The reasoning fits a different spot in this same rule.',
    wrong_label: 'This source reads the spot as the other one.',
    too_few: 'The range holds more of these than you counted.',
    too_many: 'The range holds fewer of these than you counted.',
};

export interface Explanation {
    readonly text: string;
    /** True where the text came from the source rather than the fallback. */
    readonly authored: boolean;
    /** The author's own reasoning for the rule. Always shown after a reveal. */
    readonly rationale: string;
    /** How the answer was arrived at, for the "why?" panel. */
    readonly provenance: string;
    readonly secondaryNote?: string | undefined;
}

/** The sentence, rationale and provenance shown after a reader answers. */
export function explain(
    principle: Principle,
    grade: Grade,
    resolution: AnyResolution,
): Explanation {
    // The outcome that fired speaks first — a rule with two right answers
    // has two reasons — and the principle's map answers everything else.
    // A count outcome is computed rather than authored, so it carries no
    // feedback of its own; the principle's map is the whole of it.
    const perOutcome = 'feedback' in resolution.outcome ? resolution.outcome.feedback : undefined;
    const feedback: Feedback = { ...principle.feedback, ...(perOutcome ?? {}) };
    // Every error class is a feedback key, `correct` included.
    const authoredText = feedback[grade.klass];
    const usable = authoredText !== undefined && authoredText.trim() !== '';

    return {
        text: usable ? authoredText : NEUTRAL_FALLBACK[grade.klass],
        authored: usable,
        rationale: principle.rationale,
        provenance: `${resolution.provenance.kind}: ${resolution.provenance.detail}`,
        secondaryNote: grade.secondary
            ? 'This source treats the spot as close, and counts your answer as one of the acceptable lines.'
            : undefined,
    };
}
