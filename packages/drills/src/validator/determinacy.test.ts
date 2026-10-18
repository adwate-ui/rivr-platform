import { describe, it, expect, beforeEach } from 'vitest';
import type { PredicateRule } from '../ontology/types.ts';
import { validateSource, CODES } from './index.ts';
import { findOverlaps, isShadowed, outcomeKey } from './determinacy.ts';
import { resetTagCompatibilityCache } from './tagCompatibility.ts';
import { codes, payload, principle } from './fixtures.ts';

beforeEach(() => resetTagCompatibilityCache());

const predicate = (branches: PredicateRule['branches']): PredicateRule => ({
    kind: 'predicate',
    situation: { street: 'flop' },
    branches,
    default: { action: 'check' },
});

const anyStreet = (branches: PredicateRule['branches']): PredicateRule => ({
    kind: 'predicate',
    situation: {},
    branches,
    default: { action: 'check' },
});

describe('stage 5: overlapping branches', () => {
    it('finds nothing when branches are disjoint', () => {
        expect(findOverlaps(predicate([
            { when: { hand_class_any: ['set'] }, then: { action: 'bet' } },
            { when: { hand_class_any: ['no_pair'] }, then: { action: 'check' } },
        ]))).toEqual([]);
    });

    it('finds branches that overlap and disagree, with a witness', () => {
        const overlaps = findOverlaps(predicate([
            { when: { hand_class_any: ['set', 'two_pair'] }, then: { action: 'bet' } },
            { when: { hand_class_any: ['two_pair'] }, then: { action: 'check' } },
        ]));
        expect(overlaps).toHaveLength(1);
        expect(overlaps[0]?.sameOutcome).toBe(false);
        expect(overlaps[0]?.witness.hand_class_any).toBe('two_pair');
    });

    it('reports an overlap that agrees as information, not as a problem', () => {
        const rule = predicate([
            { when: { hand_class_any: ['set', 'two_pair'] }, then: { action: 'bet', sizing: 'medium' } },
            { when: { hand_class_any: ['two_pair'] }, then: { action: 'bet', sizing: 'medium' } },
        ]);
        expect(findOverlaps(rule)[0]?.sameOutcome).toBe(true);
    });

    it('does not flag branches separated by a scalar slot', () => {
        expect(findOverlaps(predicate([
            { when: { hero_position: ['BTN'] }, then: { action: 'bet' } },
            { when: { hero_position: ['SB'] }, then: { action: 'check' } },
        ]))).toEqual([]);
    });

    it('does not flag branches whose board requirements cannot co-occur', () => {
        expect(findOverlaps(predicate([
            { when: { board_require: ['monotone'] }, then: { action: 'bet' } },
            { when: { board_require: ['rainbow'] }, then: { action: 'check' } },
        ]))).toEqual([]);
    });

    it('surfaces a real conflict through the whole pipeline as an error', () => {
        const rule = predicate([
            { when: { hand_class_any: ['set', 'two_pair'] }, then: { action: 'bet' } },
            { when: { hand_class_any: ['two_pair'] }, then: { action: 'check' } },
        ]);
        const report = validateSource(payload({ principles: [principle({ rule })] }));
        const conflict = report.findings.find((f) => f.code === CODES.DET_BRANCH_CONFLICT);
        expect(conflict?.severity).toBe('error');
        expect(report.ok).toBe(false);
    });

    it('proves two branches disjoint on the river by the flop they share, not by sampling', () => {
        // Texture is the flop's on every street, and the flop is enumerated
        // exhaustively: monotone and rainbow never co-occur, so these branches
        // are not an overlap at all — on the river as much as on the flop.
        const rule: PredicateRule = {
            // `hand_class_any` only so the rule is a legal postflop rule at all
            // — a situation that states no hand answers a set and seven-high
            // alike, and stage 3 refuses it. Nothing here turns on the list.
            situation: { street: 'river', hand_class_any: ['no_pair'] },
            kind: 'predicate',
            branches: [
                { when: { board_require: ['monotone'] }, then: { action: 'bet', feedback: { correct: 'Bet the monotone flop.' } } },
                { when: { board_require: ['rainbow'] }, then: { action: 'check', feedback: { correct: 'Check the rainbow flop.' } } },
            ],
            default: { action: 'check', feedback: { correct: 'Check.' } },
        };
        expect(findOverlaps(rule)).toEqual([]);

        const report = validateSource(payload({ principles: [principle({ rule })] }));
        expect(report.findings.find((f) => f.code === CODES.DET_BRANCH_CONFLICT)).toBeUndefined();
        expect(report.ok).toBe(true);
    });

    it('asks every street when the rule names none', () => {
        // A monotone, ace-or-king-high flop is an ordinary board, so the
        // any-street question resolves on the flop's exhaustive enumeration.
        expect(findOverlaps(anyStreet([
            { when: { board_require: ['monotone'] }, then: { action: 'bet' } },
            { when: { board_require: ['high'] }, then: { action: 'check' } },
        ]))[0]?.confidence).toBe('realisable');
    });

    it('treats a tag one branch requires and another excludes as impossible', () => {
        expect(findOverlaps(predicate([
            { when: { board_require: ['paired'] }, then: { action: 'bet' } },
            { when: { board_exclude: ['paired'] }, then: { action: 'check' } },
        ]))).toEqual([]);
    });

    it('does not overlap branches pinned to different streets', () => {
        expect(findOverlaps(anyStreet([
            { when: { street: 'flop' }, then: { action: 'bet' } },
            { when: { street: 'river' }, then: { action: 'check' } },
        ]))).toEqual([]);
    });

    it('carries a street through when only one branch names it', () => {
        expect(findOverlaps(anyStreet([
            { when: {}, then: { action: 'bet' } },
            { when: { street: 'turn' }, then: { action: 'check' } },
        ]))[0]?.witness.street).toBe('turn');
    });
});

describe('stage 5: comparing outcomes', () => {
    it('compares outcomes by value, including acceptable alternatives', () => {
        expect(outcomeKey({ action: 'bet', sizing: 'medium' })).toBe(outcomeKey({ action: 'bet', sizing: 'medium' }));
        expect(outcomeKey({ action: 'bet' })).toBe(outcomeKey({ action: 'bet', sizing: 'unspecified' }));
        expect(outcomeKey({ action: 'bet', acceptable_alternatives: [{ action: 'check' }] }))
            .not.toBe(outcomeKey({ action: 'bet' }));
        expect(outcomeKey({ action: 'bet', acceptable_alternatives: [{ action: 'check' }, { action: 'call' }] }))
            .toBe(outcomeKey({ action: 'bet', acceptable_alternatives: [{ action: 'call' }, { action: 'check' }] }));
    });

    it('handles an acceptable alternative that names only an action', () => {
        expect(outcomeKey({ action: 'bet', acceptable_alternatives: [{}] }))
            .not.toBe(outcomeKey({ action: 'bet' }));
        expect(outcomeKey({ action: 'bet', acceptable_alternatives: [{ action: 'check' }] }))
            .not.toBe(outcomeKey({ action: 'bet', acceptable_alternatives: [{ sizing: 'small' }] }));
    });
});

describe('stage 5: dead branches', () => {
    it('spots a branch entirely covered by an earlier one', () => {
        expect(isShadowed({}, { hero_position: ['BTN'] })).toBe(true);
        expect(isShadowed({ hero_position: ['BTN'] }, {})).toBe(false);
        expect(isShadowed({ hand_class_any: ['set', 'two_pair'] }, { hand_class_any: ['set'] })).toBe(true);
        expect(isShadowed({ hand_class_any: ['set'] }, {})).toBe(false);
        expect(isShadowed({ hand_class_any: ['set'] }, { hand_class_any: ['two_pair'] })).toBe(false);
        expect(isShadowed({ board_require: ['paired'] }, {})).toBe(false);
        expect(isShadowed({ board_exclude: ['paired'] }, {})).toBe(false);
        expect(isShadowed({ draw_class_exclude: ['gutshot'] }, {})).toBe(false);
        expect(isShadowed({ runout_exclude: ['overcard'] }, {})).toBe(false);
        expect(isShadowed({ street: 'flop' }, { street: 'turn' })).toBe(false);
    });

    it('warns about an unreachable branch through the pipeline', () => {
        const rule = predicate([
            { when: {}, then: { action: 'bet' } },
            { when: { hand_class_any: ['set'] }, then: { action: 'bet' } },
        ]);
        expect(codes(validateSource(payload({ principles: [principle({ rule })] })).findings))
            .toContain(CODES.DET_BRANCH_UNREACHABLE);
    });

    it('ignores range-lookup rules, which have no branches to conflict', () => {
        expect(codes(validateSource(payload()).findings)).not.toContain(CODES.DET_BRANCH_CONFLICT);
    });

    it('warns about a branch whose answer is the default, byte for byte', () => {
        // Scope written where scope does not narrow: the branch can never
        // change an answer. A real encoding shipped one.
        const rule = predicate([{ when: { hand_class_any: ['set'] }, then: { action: 'check' } }]);
        const found = validateSource(payload({ principles: [principle({ rule })] })).findings;
        expect(codes(found)).toContain(CODES.DET_BRANCH_SAME_AS_DEFAULT);
        expect(found.find((f) => f.code === CODES.DET_BRANCH_SAME_AS_DEFAULT)?.severity).toBe('warning');
    });

    it('warns about a branch that constrains nothing and so buries everything after it', () => {
        // `when: {}` matches every spot the rule admits; the default below it
        // is unreachable and the rule is a constant wearing a decision's clothes.
        const rule = predicate([{ when: {}, then: { action: 'bet', sizing: 'medium' } }]);
        expect(codes(validateSource(payload({ principles: [principle({ rule })] })).findings))
            .toContain(CODES.DET_BRANCH_ALWAYS_MATCHES);
    });

    it('does not mind a catch-all LAST branch on a rule with no default — that is just the answer', () => {
        const rule: PredicateRule = {
            kind: 'predicate', situation: { street: 'flop' },
            branches: [{ when: {}, then: { action: 'bet' } }],
        };
        expect(codes(validateSource(payload({ principles: [principle({ rule })] })).findings))
            .not.toContain(CODES.DET_BRANCH_ALWAYS_MATCHES);
    });
});
