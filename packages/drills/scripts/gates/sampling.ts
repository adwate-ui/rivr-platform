/**
 * Generating spots the way the drill session generates them.
 *
 * A gate that samples a different population from the one a reader drills
 * certifies nothing, so every sampling gate deals through here: both sides of
 * a range rule, the hero's hand from what the source's own preflop rules play
 * from that seat, and earlier streets the source's own rules would have played
 * that way.
 */
import type { OntologyPayload, Principle, Rule } from '../../src/ontology/types.ts';
import type { ComboSet } from '../../src/range/comboSet.ts';
import { expandRangeSets } from '../../src/range/expand.ts';
import { effectiveRule, type ResolveContext } from '../../src/grading/resolve.ts';
import { generateScenario, rangeSideFor } from '../../src/generator/scenario.ts';
import { preflopPlayable } from '../../src/generator/playable.ts';
import { lineFits } from '../../src/generator/lineFits.ts';
import type { GenerateResult, LineFits, Playable, Scenario } from '../../src/generator/types.ts';

export interface Sampler {
    readonly payload: OntologyPayload;
    readonly ranges: ReadonlyMap<string, ComboSet>;
    readonly context: ResolveContext;
    readonly drillable: readonly Principle[];
    readonly playable: Playable;
    readonly fitsLine: LineFits;
}

/** Everything a sampling gate needs about one encoding, computed once. */
export function samplerFor(payload: OntologyPayload): Sampler {
    const ranges = expandRangeSets(payload.range_sets);
    const context: ResolveContext = { ranges };
    return {
        payload,
        ranges,
        context,
        drillable: payload.principles.filter((principle) => principle.drillable !== false),
        playable: preflopPlayable(payload.principles, ranges),
        fitsLine: lineFits(payload.principles, context, payload.source.spr_brackets),
    };
}

/** The rule a principle is drilled by: the user's override where there is one. */
export const ruleOf = (principle: Principle): Rule => effectiveRule(principle).rule;

/** One spot dealt from a principle's rule with a seed; `accept` rejects candidates the caller cannot use. */
export function spotFor(
    sampler: Sampler,
    principle: Principle,
    seed: number,
    accept?: (candidate: Scenario) => boolean,
): GenerateResult {
    const rule = ruleOf(principle);
    return generateScenario(rule, {
        seed,
        range: rule.kind === 'range_lookup' ? sampler.ranges.get(rule.range_set_id) : undefined,
        rangeSide: rangeSideFor(rule, seed),
        playable: sampler.playable,
        lineFits: sampler.fitsLine,
        accept,
    });
}

/** The spots a principle produces over `count` seeds, seed `n` mapped through `seedOf`. */
export function spotsFor(
    sampler: Sampler,
    principle: Principle,
    seeds: { readonly count: number; readonly seedOf: (n: number) => number },
    accept?: (candidate: Scenario) => boolean,
): Scenario[] {
    const spots: Scenario[] = [];
    for (let n = 1; n <= seeds.count; n += 1) {
        const result = spotFor(sampler, principle, seeds.seedOf(n), accept);
        if (result.ok) spots.push(result.scenario);
    }
    return spots;
}
