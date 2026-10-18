/**
 * One string that stands for an answer, whatever kind of answer it is.
 *
 * Reports compare answers as text: "did the governing rule say the same thing
 * as the author", "did the runner-up have said something else". That comparison
 * was written out by hand in five places — the decomposition, the scope-gap
 * report, the determinacy check, the generator gate and the sweep — and all
 * five spelled an action the same way by agreement rather than by construction.
 * Agreement is fine until a sixth kind of answer exists and only four of the
 * five learn about it.
 *
 * **The action spelling is load-bearing and must not change.** It is
 * `action:sizing`, with an absent sizing written `unspecified`, and reports
 * written before any change would stop comparing equal to ones written after it
 * without anything being wrong with the encoding, which is why
 * `answerKey.test.ts` pins the exact bytes rather than checking the shape.
 */

import type { Action, SizingBucket } from '../ontology/types.ts';

/** The sizing half of an action key. Absent means the source stated none. */
export const sizingKey = (sizing: SizingBucket | undefined): string => sizing ?? 'unspecified';

/**
 * An action answer, as the reports have always spelled it.
 *
 * `acceptable_alternatives` are deliberately NOT part of this. A key says what
 * the answer was, and a rule that also permits a second line still gave one
 * answer; the determinacy check appends the alternatives itself because it is
 * asking a different question — whether two branches are distinguishable.
 */
export const actionKey = (outcome: { readonly action: Action; readonly sizing?: SizingBucket | undefined }): string =>
    `${outcome.action}:${sizingKey(outcome.sizing)}`;

/**
 * A classification answer: the label the rule chose.
 *
 * Prefixed rather than bare so that no label can ever collide with an action.
 * A source is free to name a label `fold`, and a reader of a report should not
 * have to know whether that row was a decision or a reading.
 */
export const labelKey = (label: string): string => `label:${label}`;

/** A combination count. The number, prefixed for the same reason as a label. */
export const countKey = (value: number): string => `count:${value}`;
