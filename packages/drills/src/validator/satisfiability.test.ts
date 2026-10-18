import { describe, it, expect, beforeEach } from 'vitest';
import type { PredicateRule } from '../ontology/types.ts';
import { situationConjunction } from '../generator/slots.ts';
import { validateSource, CODES } from './index.ts';
import { checkSituation, principleSituations, ruleSituations } from './satisfiability.ts';
import { resetTagCompatibilityCache } from './tagCompatibility.ts';
import { checkRule, codes, payload, principle } from './fixtures.ts';

beforeEach(() => resetTagCompatibilityCache());

describe('stage 4: satisfiability', () => {
    it('proves an empty slot impossible and names it', () => {
        const result = checkSituation({ hero_position: [] });
        expect(result.result).toBe('unsatisfiable');
        expect(result.conflicts[0]?.slot).toBe('hero_position');
    });

    it('proves a contradictory board impossible without searching for one', () => {
        const result = checkSituation({ street: 'flop', board_require: ['monotone', 'rainbow'] });
        expect(result.result).toBe('unsatisfiable');
        expect(result.attempts).toBe(0);
    });

    it('finds a witness for a situation that is merely specific', () => {
        const result = checkSituation({ street: 'flop', board_require: ['monotone'] }, { seed: 7 });
        expect(result.result).toBe('satisfiable');
        expect(result.witness?.board).toBeTruthy();
    });

    it('needs no search at all when nothing about the cards is constrained', () => {
        const result = checkSituation({ street: 'flop', hero_position: ['BTN'] });
        expect(result.result).toBe('satisfiable');
        expect(result.attempts).toBe(0);
    });

    it('gives up rather than looping, and says so as a warning not a proof', () => {
        const result = checkSituation(
            { street: 'flop', board_require: ['trips'], hand_class_any: ['straight'] },
            { seed: 1, limit: 30 },
        );
        expect(result.result).toBe('not-found');
        expect(result.attempts).toBe(30);
    });

    it('reports a not-found as a warning, leaving the payload valid', () => {
        const thin = payload({
            principles: [principle({
                rule: checkRule({ street: 'flop', board_require: ['trips'], hand_class_any: ['straight'] }),
            })],
        });
        const report = validateSource(thin, { attemptLimit: 30 });
        expect(codes(report.findings)).toContain(CODES.NO_SCENARIO_FOUND);
        expect(report.findings.find((f) => f.code === CODES.NO_SCENARIO_FOUND)?.severity).toBe('warning');
    });

    it('reports an impossible board as an error', () => {
        const broken = payload({
            principles: [principle({ rule: checkRule({ street: 'flop', board_require: ['monotone', 'rainbow'] }) })],
        });
        const report = validateSource(broken);
        expect(codes(report.findings)).toContain(CODES.BOARD_TAGS_IMPOSSIBLE);
        expect(report.ok).toBe(false);
    });

    it('checks each branch, not only the rule situation', () => {
        const rule: PredicateRule = {
            kind: 'predicate',
            situation: { street: 'flop' },
            branches: [{ when: { hero_position: [] }, then: { action: 'bet' } }],
            default: { action: 'check' },
        };
        expect(ruleSituations(rule)).toHaveLength(2);
        expect(codes(validateSource(payload({ principles: [principle({ rule })] })).findings))
            .toContain(CODES.SLOT_UNSATISFIABLE);
    });

    it('checks each exception, not only the rule and its branches', () => {
        // The blind spot this closed: a preflop principle whose EXCEPTION keys
        // on a made-hand class. The rule reads fine, the exception can never
        // fire, and nothing said so.
        const withException = principle({
            rule: { kind: 'predicate', situation: { street: ['preflop'] }, branches: [], default: { action: 'fold' } },
            exceptions: [{ when: { hand_class_any: ['set'] }, then: { action: 'raise' } }],
        });
        expect(principleSituations(withException).map((entry) => entry.path))
            .toEqual(['rule/situation', 'exceptions/0/when']);

        const findings = validateSource(payload({ principles: [withException] })).findings
            .filter((finding) => finding.code === CODES.SLOT_UNSATISFIABLE);
        expect(findings).toHaveLength(1);
        expect(findings[0]?.path).toBe('/principles/0/exceptions/0/when');
    });

    it('walks the override rule rather than the base one when a principle has both', () => {
        const overridden = principle({
            override_rule: {
                kind: 'predicate',
                situation: { street: ['turn'] },
                branches: [{ when: { hand_class_any: ['set'] }, then: { action: 'bet' } }],
                default: { action: 'check' },
            },
        });
        expect(principleSituations(overridden).map((entry) => entry.path))
            .toEqual(['override_rule/situation', 'override_rule/branches/0/when']);
    });

    it('conjoins a branch with the rule rather than letting it override', () => {
        // street is intersected, not replaced, so a flop rule with a turn branch
        // is dead code and says so. Under a spread merge this looked satisfiable.
        const dead = payload({
            principles: [principle({
                rule: {
                    kind: 'predicate',
                    situation: { street: ['flop'] },
                    branches: [{ when: { street: ['turn'] }, then: { action: 'bet' } }],
                    default: { action: 'check' },
                },
            })],
        });
        const findings = validateSource(dead).findings
            .filter((finding) => finding.code === CODES.SLOT_UNSATISFIABLE);
        expect(findings.map((finding) => finding.path)).toContain('/principles/0/rule/branches/0/when');
    });

    it('accumulates board requirements across a conjunction instead of intersecting them', () => {
        // board_require already means "all of these", so requiring `paired` in
        // the rule and `two_tone` in the branch requires BOTH. Intersecting the
        // two lists would empty them and condemn a good branch.
        const merged = situationConjunction(
            { street: ['flop'], board_require: ['paired'] },
            { board_require: ['two_tone'] },
        );
        expect(merged.board_require).toEqual(['paired', 'two_tone']);
        expect(checkSituation(merged, { seed: 9 }).result).toBe('satisfiable');
    });

    it('intersects a scalar slot down to the values both sides allow', () => {
        expect(situationConjunction(
            { hero_position: ['BTN', 'CO'] },
            { hero_position: ['CO', 'SB'] },
        ).hero_position).toEqual(['CO']);
        // Disjoint is the signal: nothing satisfies both.
        expect(situationConjunction(
            { pot_type: ['limped'] },
            { pot_type: ['three_bet'] },
        ).pot_type).toEqual([]);
    });

    it('normalises a bare-string street before intersecting it', () => {
        // The schema lets a source write street as a scalar, so "flop" and
        // ["flop"] must not look disjoint.
        expect(situationConjunction({ street: 'flop' }, { street: ['flop', 'turn'] }).street)
            .toEqual(['flop']);
        // ...from either side.
        expect(situationConjunction({ street: ['flop', 'turn'] }, { street: 'turn' }).street)
            .toEqual(['turn']);
    });

    it('takes the narrower side when only one of them names the slot', () => {
        const merged = situationConjunction({ street: ['flop'] }, { hand_class_any: ['set'] });
        expect(merged.street).toEqual(['flop']);
        expect(merged.hand_class_any).toEqual(['set']);
    });
});
