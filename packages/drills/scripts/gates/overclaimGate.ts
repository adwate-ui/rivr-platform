/**
 * How often does a rule answer a hand it never looked at?
 *
 * The quiz harness measures fidelity on the source's worked examples; the
 * generator invents the spots a reader actually drills. A rule whose situation
 * does not constrain the hand claims every hand on its board, and a catch-all
 * default then answers the ones its branches never considered: one verdict,
 * and one reason, for a set and for seven-high.
 *
 * Fails on any spot answered by a default whose rule never read the hand, on
 * any strong hand such a rule tells to check or fold, and on folding the nuts
 * however the rule got there. The validator refuses a rule that never reads the
 * hand (`HAND_NEVER_EXAMINED`); this is the runtime half, for a rule that names
 * a hand class and still answers by a hand-blind default.
 */
import type { Principle, Rule } from '../../src/ontology/types.ts';
import type { Scenario } from '../../src/generator/types.ts';
import { abstainsOn, answerKindOf, resolveGoverning } from '../../src/grading/resolve.ts';
import { governingPrinciple } from '../../src/grading/arbitrate.ts';
import { show } from '../../src/boardEnumeration.ts';
import { ruleOf, samplerFor, spotsFor, type Sampler } from './sampling.ts';
import { bump, say, share } from './output.ts';
import { allowlistFor, OVERCLAIM_ALLOWED } from './allowlists.ts';
import { verdictForFindings, type Gate } from './gate.ts';
import { absurdGiveUp, foldsTheNuts } from './absurdity.ts';

const SEEDS = { count: 40, seedOf: (n: number): number => n * 104729 + 11 };

/** The four coordinates that say something about the hero's cards. */
const HAND_SLOTS = ['hand_class_any', 'draw_class_any', 'draw_class_exclude', 'relative_strength_any'] as const;

interface Tally {
    spots: number;
    byDefault: number;
    byCatchAll: number;
    unexamined: number;
    ungoverned: number;
    readonly absurd: string[];
    readonly perPrinciple: Map<string, number>;
}

/** Every way a rule can be said to have looked at the hand: its situation, or a branch. */
function readsTheHand(rule: Rule): boolean {
    const reads = (situation: Rule['situation']): boolean => HAND_SLOTS.some((slot) => (situation[slot] ?? []).length > 0);
    return reads(rule.situation) || (rule.kind === 'predicate' && rule.branches.some((branch) => reads(branch.when)));
}

const describeSpot = (s: Scenario, governing: Principle, action: string): string =>
    `${governing.id.padEnd(28)} ${show(s.hole)} on ${show(s.board).padEnd(17)} = ${s.handClass}/${s.relativeStrength} -> "${action}"`;

/**
 * A default on a rule WITH branches is a catch-all: it answers what the
 * branches excluded. On a rule without branches it is simply the rule's only
 * answer, which is not the defect the catch-all figure is about.
 */
function countDefault(tally: Tally, rule: Rule, fromDefault: boolean): void {
    if (!fromDefault) return;
    tally.byDefault += 1;
    if (rule.kind === 'predicate' && rule.branches.length > 0) tally.byCatchAll += 1;
}

function judge(sampler: Sampler, principle: Principle, s: Scenario, tally: Tally): void {
    const answerKind = answerKindOf(ruleOf(principle));
    const governing = governingPrinciple(s, sampler.payload.principles, { ...sampler.context, answerKind });
    if (governing === null) {
        tally.ungoverned += 1;
        return;
    }
    const resolution = resolveGoverning(governing, s, sampler.context);
    tally.spots += 1;
    const rule = ruleOf(governing);
    const fromDefault = resolution.provenance.kind === 'default';
    countDefault(tally, rule, fromDefault);
    const action = resolution.outcome.action;
    const handBlind = fromDefault && !readsTheHand(rule);
    if (handBlind) {
        tally.unexamined += 1;
        bump(tally.perPrinciple, governing.id);
    }
    const absurd = handBlind
        ? s.handClass !== undefined && absurdGiveUp(action, s.handClass)
        : foldsTheNuts(action, s.relativeStrength);
    if (absurd) tally.absurd.push(describeSpot(s, governing, action));
}

function measure(sampler: Sampler): { tally: Tally; skipped: number } {
    const tally: Tally = { spots: 0, byDefault: 0, byCatchAll: 0, unexamined: 0, ungoverned: 0, absurd: [], perPrinciple: new Map() };
    // Every question here is about an action, so a label or count rule is counted and skipped.
    const actionRules = sampler.drillable.filter((principle) => {
        const kind = ruleOf(principle).kind;
        return kind !== 'classify' && kind !== 'count';
    });
    for (const principle of actionRules) {
        const spots = spotsFor(sampler, principle, SEEDS).filter((s) => !abstainsOn(principle, s, sampler.context));
        spots.forEach((s) => judge(sampler, principle, s, tally));
    }
    return { tally, skipped: sampler.drillable.length - actionRules.length };
}

function printTally(tally: Tally, skipped: number): void {
    say(`spots generated:                         ${tally.spots}`);
    say(`answered by a default:                   ${tally.byDefault}  (${share(tally.byDefault, tally.spots)})`);
    say(`...of which a catch-all (rule has branches): ${tally.byCatchAll}  (${share(tally.byCatchAll, tally.spots)})`);
    say(`...where the rule never reads the hand:  ${tally.unexamined}  (${share(tally.unexamined, tally.spots)})`);
    say(`absurd (strong hand told to give up):    ${tally.absurd.length}  (${share(tally.absurd.length, tally.spots)})`);
    tally.absurd.slice(0, 12).forEach((line) => say(`  ${line}`));
    if (skipped > 0) say(`${skipped} rule(s) skipped: this gate measures actions, and neither a label nor a count is one.`);
}

export const overclaimGate: Gate = {
    name: 'overclaim',
    run(run) {
        const sampler = samplerFor(run.source.payload);
        const { tally, skipped } = measure(sampler);
        printTally(tally, skipped);
        if (tally.ungoverned > 0) {
            say(`${tally.ungoverned} generated spot(s) that no principle governs: the session would have nothing to grade them by.`);
            return false;
        }
        const allowed = allowlistFor(OVERCLAIM_ALLOWED, run.source.payload.source.id);
        const offenders = [...tally.perPrinciple].filter(([id]) => !allowed.has(id));
        offenders.forEach(([id, count]) => say(`  ${String(count).padStart(3)} spot(s) answered by ${id} without reading the hand`));
        if (offenders.length === 0 && tally.absurd.length === 0) {
            say('Every answer read the hand, and no rule gives up on one it never examined.');
            return true;
        }
        if (offenders.length > 0) say('State the hands the rule is about, or write every class out if it means all of them.');
        return verdictForFindings(run, 'overclaim');
    },
};
