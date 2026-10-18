/**
 * The baseline valid payload the validator tests build on, and its parts.
 * Test-only: each test narrows one field of a payload every stage accepts.
 */
import type { OntologyPayload, PredicateRule, Principle, RangeLookupRule, Situation } from '../ontology/types.ts';
import type { Finding } from './report.ts';

/** A preflop button-open lookup with an answer, and a reason, on each side. */
export const rangeRule = (over: Partial<RangeLookupRule> = {}): RangeLookupRule => ({
    kind: 'range_lookup',
    situation: { street: 'preflop', hero_position: ['BTN'] },
    range_set_id: 'rs_1',
    // Two answers, two reasons: stage 6 asks each side to say why it is
    // right, because the principle's one `correct` cannot.
    in_range: { action: 'raise', sizing: 'medium', feedback: { correct: 'On the list.' } },
    out_of_range: { action: 'fold', feedback: { correct: 'Off the list.' } },
    ...over,
});

/** A branchless predicate rule over `situation` that always answers `check`. */
export const checkRule = (situation: Situation): PredicateRule => ({
    kind: 'predicate', situation, branches: [], default: { action: 'check' },
});

/** A valid drillable principle, overridden field by field. */
export const principle = (over: Partial<Principle> = {}): Principle => ({
    id: 'pr_1',
    source_id: 'src_test',
    name: 'Test principle',
    rule: rangeRule(),
    rationale: 'Because.',
    // Complete, because this is the baseline VALID payload every test builds
    // on, and stage 6 asks for an answer to every mistake a rule can produce.
    // Tests that swap in their own rule reach a different set of mistakes, so
    // all five directional keys are here rather than the four this rule needs.
    feedback: {
        correct: 'Right.',
        too_loose: 'Too wide.',
        too_tight: 'Too narrow.',
        too_passive: 'Raise it.',
        too_aggressive: 'Slow down.',
        wrong_sizing: 'Bigger.',
    },
    ...over,
});

/** A valid payload around the default principle, overridden field by field. */
export const payload = (over: Partial<OntologyPayload> = {}): OntologyPayload => ({
    ontology_version: '1.0',
    source: { id: 'src_test', title: 'Test', kind: 'personal_notes' },
    opponent_types: [{ id: 'opp_1', label: 'Rock', canonical_archetype: 'nit' }],
    range_sets: [{ id: 'rs_1', hands: ['22+', 'AKs'] }],
    principles: [principle()],
    ...over,
});

/** A payload whose one principle is a branchless rule over `situation` that bets small. */
export const betSmallPayload = (situation: Situation): OntologyPayload => payload({
    principles: [principle({
        rule: { kind: 'predicate', situation, branches: [], default: { action: 'bet', sizing: 'small' } },
    })],
});

/** The codes of some findings, for asserting on what fired. */
export const codes = (findings: readonly Finding[]): string[] => findings.map((finding) => finding.code);
