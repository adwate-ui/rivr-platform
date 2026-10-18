/**
 * The re-encoding work list.
 *
 * Everything else in this directory measures. This one says what to do, per
 * principle, with the passage reference to do it against.
 *
 * The pattern it exists to fix: a principle is exclusive in the source because of
 * the conditions the prose states, and the ontology gives a condition three
 * places to live — `situation`, `branches[].when`, and `node_path`. Only
 * `situation` decides which spots the rule CLAIMS. A condition that scopes the
 * principle but was encoded as a branch turns an exclusive rule into an
 * over-claiming one, and a mandatory `default` then makes it answer everything
 * its branches missed.
 *
 * So for each principle this reports the conditions that appear in its branches
 * and not in its situation — the demoted scope — alongside the evidence for
 * whether that demotion is what is costing it: which hands it gets right, which
 * it gets wrong, and what coordinate separates them.
 */

import type { OntologyPayload, Outcome, Principle, Rule, Situation } from '../ontology/types.ts';
import { SPECIFICITY_SLOTS, specificity } from '../grading/arbitrate.ts';
import { effectiveRule, resolveGoverningAny, type ResolveContext } from '../grading/resolve.ts';
import { actionKey } from '../grading/answerKey.ts';
import { expandRangeSets } from '../range/expand.ts';
import { claimVolume, type ClaimVolume } from './claimVolume.ts';
import { governingIdOf, handsById, principleOf, readGraded, type GradedHand } from './gradedHand.ts';
import type { HarnessReport } from './results.ts';
import { separation, type Separation } from './separation.ts';

export interface GapHand {
    readonly quizId: string;
    readonly pageRef: string | null;
    readonly verdict: 'pass' | 'fail';
    readonly expected: string;
    readonly actual: string;
    /** `branch`, `default`, `exception`, … — how the answer was arrived at. */
    readonly answeredBy: string;
}

export interface ScopeGap {
    readonly principleId: string;
    readonly name: string;
    readonly width: number;
    readonly handsClaimed: number;
    readonly handsGoverned: number;
    readonly right: number;
    readonly wrong: number;
    /**
     * Coordinates its BRANCHES constrain that its SITUATION does not.
     *
     * The demoted scope. Each one is a condition the encoder knew mattered —
     * they wrote it into a branch — but that does not stop the rule claiming
     * spots where it does not hold.
     */
    readonly demotedToBranches: readonly string[];
    /** Scope conditions in `node_path`, which matching now honours. */
    readonly pathScope: readonly string[];
    /** How many of its governed hands fell through to the default. */
    readonly answeredByDefault: number;
    readonly hasDefault: boolean;
    readonly defaultAnswer: string | null;
    /** Coordinates whose values split its passes from its failures. */
    readonly separators: Separation['separators'];
    readonly hands: readonly GapHand[];
}

/** An action answer as the work list spells it. A graded action result always has both answers. */
function answerText(outcome: Outcome | undefined): string {
    if (outcome === undefined) throw new Error('A graded action result is missing an answer.');
    return actionKey(outcome);
}

/** Coordinates a set of branch conditions constrains. */
function branchCoordinates(situations: readonly Situation[]): string[] {
    const found = new Set<string>();
    situations.forEach((situation) => {
        SPECIFICITY_SLOTS.forEach((slot) => {
            const value = situation[slot];
            if (value === undefined) return;
            if (Array.isArray(value) && value.length === 0) return;
            found.add(String(slot));
        });
    });
    return [...found].sort();
}

/** How each principle answered the hands it governed. */
interface Governed {
    readonly hands: Map<string, GapHand[]>;
    readonly fellThrough: Map<string, number>;
}

/** One graded hand, as its governing principle answered it. */
function gapHandFor(hand: GradedHand, principle: Principle, ranges: ResolveContext['ranges']): GapHand {
    const { result, quiz } = hand;
    // Resolved in the hand's own kind: a count rule has no action to resolve.
    const answeredBy = resolveGoverningAny(principle, hand.scenario, { ranges }).provenance.kind;
    return {
        quizId: result.quizId,
        pageRef: quiz.page_ref === undefined ? null : String(quiz.page_ref),
        verdict: result.verdict === 'pass' ? 'pass' : 'fail',
        // A label or a count carries its own key; an action is spelt here.
        expected: result.expectedKey ?? answerText(result.expected),
        actual: result.actualKey ?? answerText(result.actual),
        answeredBy,
    };
}

/** Every graded hand, filed under the principle that governed it. */
function governedHands(report: HarnessReport, payload: OntologyPayload): Governed {
    const ranges = expandRangeSets(payload.range_sets);
    const quizzes = handsById(payload);
    const principles = new Map(payload.principles.map((principle) => [principle.id, principle]));
    const governed: Governed = { hands: new Map(), fellThrough: new Map() };
    for (const result of report.results) {
        if (result.verdict !== 'pass' && result.verdict !== 'fail') continue;
        const id = governingIdOf(result);
        const gap = gapHandFor(readGraded(result, quizzes, payload), principleOf(principles, id), ranges);
        if (gap.answeredBy === 'default') governed.fellThrough.set(id, (governed.fellThrough.get(id) ?? 0) + 1);
        governed.hands.set(id, [...(governed.hands.get(id) ?? []), gap]);
    }
    return governed;
}

/** Coordinates the situation itself constrains. */
const situationCoordinates = (situation: Situation): Set<string> => new Set(
    SPECIFICITY_SLOTS
        .filter((slot) => {
            const value = situation[slot];
            return value !== undefined && (!Array.isArray(value) || value.length > 0);
        })
        .map(String),
);

interface GapInputs {
    readonly governed: Governed;
    readonly volumes: ReadonlyMap<string, ClaimVolume>;
    readonly splits: ReadonlyMap<string, Separation>;
}

/** Branch conditions its situation does not carry: the demoted scope. */
function demotedScope(rule: Rule): string[] {
    const branches = rule.kind === 'predicate' ? rule.branches.map((branch) => branch.when) : [];
    const inSituation = situationCoordinates(rule.situation);
    return branchCoordinates(branches).filter((slot) => !inSituation.has(slot));
}

/** Whether the rule has a fallback answer, and what it is. */
function defaultColumns(rule: Rule): Pick<ScopeGap, 'hasDefault' | 'defaultAnswer'> {
    const fallback = rule.kind === 'predicate' ? rule.default : undefined;
    return { hasDefault: fallback !== undefined, defaultAnswer: fallback === undefined ? null : actionKey(fallback) };
}

/** How many hands the principle claims and governs; `claimVolume` emits a row for every drillable one. */
function claimColumns(volume: ClaimVolume | undefined): Pick<ScopeGap, 'handsClaimed' | 'handsGoverned'> {
    return { handsClaimed: volume?.handsClaimed ?? 0, handsGoverned: volume?.handsGoverned ?? 0 };
}

/** One principle's gap entry. */
function gapFor(principle: Principle, { governed, volumes, splits }: GapInputs): ScopeGap {
    const { rule } = effectiveRule(principle);
    const mine = governed.hands.get(principle.id) ?? [];
    return {
        principleId: principle.id,
        name: principle.name,
        width: specificity(rule.situation),
        ...claimColumns(volumes.get(principle.id)),
        right: mine.filter((hand) => hand.verdict === 'pass').length,
        wrong: mine.filter((hand) => hand.verdict === 'fail').length,
        demotedToBranches: demotedScope(rule),
        pathScope: rule.situation.node_path ?? [],
        answeredByDefault: governed.fellThrough.get(principle.id) ?? 0,
        ...defaultColumns(rule),
        separators: splits.get(principle.id)?.separators ?? [],
        hands: mine,
    };
}

/**
 * Every principle worth re-reading a passage for, worst first.
 *
 * Ordered by wrong answers, then by claim volume: a rule that claims a lot and
 * is never asked about is a latent version of the same problem, and worth
 * seeing below the ones actively failing.
 */
export function scopeGaps(report: HarnessReport, payload: OntologyPayload): ScopeGap[] {
    const inputs: GapInputs = {
        governed: governedHands(report, payload),
        volumes: new Map(claimVolume(payload).map((entry) => [entry.principleId, entry])),
        splits: new Map(separation(report, payload).map((entry) => [entry.principleId, entry])),
    };
    return payload.principles
        .filter((principle) => principle.drillable !== false)
        .map((principle) => gapFor(principle, inputs))
        .filter((gap) => gap.wrong > 0 || gap.demotedToBranches.length > 0 || gap.handsClaimed > 0)
        .sort((x, y) => y.wrong - x.wrong
            || y.handsClaimed - x.handsClaimed
            || x.principleId.localeCompare(y.principleId));
}
