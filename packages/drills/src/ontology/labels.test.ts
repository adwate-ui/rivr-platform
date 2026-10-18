import { describe, it, expect } from 'vitest';
import {
    BOARD_TAGS, BOARD_TAG_LABEL, DRAW_CLASSES, DRAW_CLASS_LABEL,
    HAND_CLASSES, HAND_CLASS_LABEL, PLAYER_COUNTS, PLAYER_COUNT_LABEL,
    POSITIONS, POSITION_LABEL, POT_TYPES, POT_TYPE_LABEL,
    RELATIVE_STRENGTHS, RELATIVE_STRENGTH_LABEL, SIZING_BUCKETS, SIZING_LABEL,
    SLOT_LABEL, SPR_BRACKETS, SPR_BRACKET_LABEL, STACK_BRACKETS, STACK_BRACKET_LABEL,
    STREETS, STREET_NAMES, VILLAIN_ARCHETYPES, VILLAIN_ARCHETYPE_LABEL,
    VILLAIN_RAISE_SIZES, VILLAIN_RAISE_SIZE_LABEL,
} from './types.ts';
import { ERROR_CLASS_LABEL } from '../grading/classifyError.ts';

/**
 * Every closed vocabulary has a word for every member.
 *
 * `.replace(/_/g, ' ')` was the drill UI's formatting strategy, and it read
 * acceptably — "SPR medium", "large bet" — which is what made it dangerous
 * rather than merely untidy: the enums can grow a member that needs more than
 * a space at any time, and nothing on any screen would notice. `GradeReveal`
 * was already showing it live, printing a raw `Situation` key into the middle
 * of an English sentence.
 *
 * TypeScript's `Record<Union, string>` already makes a MISSING entry a compile
 * error. What it cannot catch is the two failures below, so they are asserted:
 * an entry for something the union does not contain (a member renamed, its
 * label left behind), and a label that is still an id in disguise.
 */

const VOCABULARIES: readonly [string, readonly string[], Readonly<Record<string, string>>][] = [
    ['position', POSITIONS, POSITION_LABEL],
    ['street', STREETS, STREET_NAMES],
    ['pot type', POT_TYPES, POT_TYPE_LABEL],
    ['player count', PLAYER_COUNTS, PLAYER_COUNT_LABEL],
    ['stack bracket', STACK_BRACKETS, STACK_BRACKET_LABEL],
    ['villain raise size', VILLAIN_RAISE_SIZES, VILLAIN_RAISE_SIZE_LABEL],
    ['sizing bucket', SIZING_BUCKETS, SIZING_LABEL],
    ['SPR bracket', SPR_BRACKETS, SPR_BRACKET_LABEL],
    ['villain archetype', VILLAIN_ARCHETYPES, VILLAIN_ARCHETYPE_LABEL],
    ['board tag', BOARD_TAGS, BOARD_TAG_LABEL],
    ['hand class', HAND_CLASSES, HAND_CLASS_LABEL],
    ['draw class', DRAW_CLASSES, DRAW_CLASS_LABEL],
    ['relative strength', RELATIVE_STRENGTHS, RELATIVE_STRENGTH_LABEL],
];

describe('every vocabulary is named', () => {
    it.each(VOCABULARIES)('%s', (_name, members, labels) => {
        expect(Object.keys(labels).sort()).toEqual([...members].sort());
    });

    it.each(VOCABULARIES)('%s says nothing with an underscore in it', (_name, _members, labels) => {
        expect(Object.values(labels).filter((label) => label.includes('_'))).toEqual([]);
    });

    /**
     * The one that was reaching a screen raw: "that answer is the one this rule
     * gives for a different preflop_facing_state". `keyof Situation` makes a new
     * coordinate a compile error at the map, so this asserts the other half —
     * that nothing in it is still an id.
     */
    it('names every Situation coordinate in words', () => {
        const labels = Object.values(SLOT_LABEL);
        expect(labels.length).toBeGreaterThan(0);
        expect(labels.filter((label) => label.includes('_'))).toEqual([]);
    });

    /**
     * The verdict's own wording, which the review page also prints. Two copies
     * of this is how one screen comes to read "wrong sizing" while the other
     * reads "Right action, wrong size".
     */
    it('names every error class the same way on every screen', () => {
        expect(Object.keys(ERROR_CLASS_LABEL).sort()).toEqual([
            'correct', 'right_idea_wrong_spot', 'too_aggressive', 'too_few',
            'too_loose', 'too_many', 'too_passive', 'too_tight', 'wrong_label',
            'wrong_sizing',
        ]);
        expect(Object.values(ERROR_CLASS_LABEL).filter((label) => label.includes('_'))).toEqual([]);
    });
});
