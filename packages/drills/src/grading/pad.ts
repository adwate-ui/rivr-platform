/**
 * What the answer pad can produce.
 *
 * Three modules had opinions about this and each kept its own copy: the pad
 * itself, the harness diagnostics computing a guessing floor, and the grader
 * deciding which mistakes are reachable. A guessing floor derived from a
 * different choice set than the one on screen is not a floor, so this is one
 * definition or it is worthless.
 *
 * The action sets live next door in `classifyError.ts` (`legalActions`),
 * because which actions are legal depends on the spot and these two facts do
 * not.
 */

import { SIZING_LABEL, type Action, type SizingBucket, type Source, type Street } from '../ontology/types.ts';

/** The four the pad renders. `unspecified` is an authoring value, not a button. */
export const PAD_SIZINGS: readonly SizingBucket[] = ['small', 'medium', 'large', 'all_in'];

/** The action as a word on a button, in a legend, or in a verdict badge. */
export const ACTION_LABEL: Readonly<Record<Action, string>> = {
    fold: 'Fold', check: 'Check', call: 'Call', bet: 'Bet',
    raise: 'Raise', limp: 'Limp', all_in: 'All in',
};

/**
 * The pad's four slots, in the one order they are ever drawn in.
 *
 * One slot per KIND of decision — give up, match, put chips in, put them all in
 * — rather than one cell per legal action. The pad used to lay its buttons out
 * with `flex flex-wrap`, so the shape changed with the legal set: `legalActions`
 * has three outputs and they wrapped into three different arrangements on a
 * phone. A drill is a repetition loop, and the control it repeats on was moving.
 *
 * A slot holding no legal action for this spot draws a disabled cell rather than
 * disappearing, which is what keeps Fold in the same place on a spot that cannot
 * be folded. `legalActions` still decides what is ENABLED; this only decides
 * where things sit.
 *
 * At most one action per slot is ever legal at once — you cannot both call a
 * raise and limp into it, or both bet and raise — so a slot never has to render
 * two cells and the grid never has to grow.
 */
export const PAD_SLOTS: readonly {
    readonly id: string;
    /** What the empty cell says, so the slot is legible even when unusable. */
    readonly label: string;
    readonly actions: readonly Action[];
}[] = [
    { id: 'passive', label: 'Fold', actions: ['fold'] },
    { id: 'matching', label: 'Check', actions: ['check', 'call', 'limp'] },
    { id: 'aggressive', label: 'Raise', actions: ['bet', 'raise'] },
    { id: 'all-in', label: 'All in', actions: ['all_in'] },
];

/**
 * "Raise (large)" -- the size is half of what a source teaches, so it rides
 * along whenever the source specified one. The pad, the strategy grid and the
 * verdict badge all say the answer this way or the reader meets three names
 * for one thing.
 */
export function describeOutcome(outcome: { readonly action: Action; readonly sizing?: SizingBucket | undefined }): string {
    const size = outcome.sizing === undefined || outcome.sizing === 'unspecified'
        ? ''
        : ` (${SIZING_LABEL[outcome.sizing].toLowerCase()})`;
    return `${ACTION_LABEL[outcome.action]}${size}`;
}

/**
 * The reader-facing text for a label id.
 *
 * A classify rule stores and grades `id` but shows `label`, so that a source can
 * reword "strong fit" without invalidating every attempt recorded under the old
 * words. Everything that prints an answer has to go through here, or the pad
 * shows the source's wording and the review page shows the raw id.
 *
 * An id with no matching label falls back to the id itself. That state is a
 * validator error (`UNKNOWN_LABEL`), so this is what a reader sees in the
 * window between a bad encoding shipping and the gate catching it: ugly, and
 * still better than blank.
 */
export function labelText(
    labelId: string,
    labels: readonly { readonly id: string; readonly label: string }[],
): string {
    return labels.find((entry) => entry.id === labelId)?.label ?? labelId;
}

/**
 * Any answer, in the words the reader saw when they gave it.
 *
 * One function rather than a caller-side switch, because the three places that
 * print an answer — the pad, the verdict, the review row — drifted into three
 * spellings the last time each did its own formatting.
 */
export function describeAnswer(
    answer:
        | { readonly kind: 'action'; readonly action: Action; readonly sizing?: SizingBucket | undefined }
        | { readonly kind: 'classify'; readonly label: string;
            readonly labels: readonly { readonly id: string; readonly label: string }[] }
        | { readonly kind: 'count'; readonly value: number; readonly of?: number | undefined },
): string {
    if (answer.kind === 'action') return describeOutcome(answer);
    if (answer.kind === 'classify') return labelText(answer.label, answer.labels);
    // "24 of 40" where the denominator is known, because a bare "24" says
    // nothing about whether that is most of the range or a corner of it.
    return answer.of === undefined ? String(answer.value) : `${answer.value} of ${answer.of}`;
}

/** Sizing only means something for an action that puts chips in. */
export const takesSizing = (action: Action): boolean => action === 'bet' || action === 'raise';

/**
 * What each size on the pad means for this source, on this street.
 *
 * Postflop the buckets are pot FRACTIONS from `source.bet_size_brackets`;
 * preflop they are pot MULTIPLES from `source.raise_size_brackets` — a raise
 * is measured against the pot it raises into, never against the blind. A
 * source that states neither gets no hints, and the pad shows bare words —
 * which is what every reader saw before these existed, guessing at "Medium"
 * while the grader did not.
 */
export function sizingHints(
    street: Street,
    source: Pick<Source, 'bet_size_brackets' | 'raise_size_brackets'>,
): Partial<Record<SizingBucket, string>> {
    const percent = (fraction: number): string => `${Math.round(fraction * 100)}%`;
    if (street === 'preflop') {
        const brackets = source.raise_size_brackets;
        if (brackets?.small_max === undefined || brackets.standard_max === undefined) return {};
        return {
            small: `up to ${brackets.small_max}× the pot`,
            medium: `${brackets.small_max}–${brackets.standard_max}× the pot`,
            large: `over ${brackets.standard_max}× the pot`,
        };
    }
    const brackets = source.bet_size_brackets;
    if (brackets?.small_max === undefined || brackets.standard_max === undefined) return {};
    return {
        small: `up to ${percent(brackets.small_max)} of the pot`,
        medium: `${Math.round((brackets.small_max + 0.01) * 100)}–${percent(brackets.standard_max)}`,
        large: `over ${percent(brackets.standard_max)}`,
    };
}
