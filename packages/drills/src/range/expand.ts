/**
 * Range sets, resolved.
 *
 * A `range_set` may name a parent with `derived_from`, so expanding one is a
 * graph walk rather than a parse:
 *
 *     combos(set) = combos(parent) ∪ hands(set) − excludes(set)
 *
 * `excludes` is applied LAST and after the union, which is what lets a source
 * write "the button range, minus the weakest suited hands" without restating
 * the range. Applying it before the union would silently do nothing whenever
 * the excluded hand came from the parent, which is the only case anybody uses
 * it for.
 *
 * Cycles are detected rather than recursed into. A source that says A derives
 * from B and B from A is a broken encoding, and the import must say so with
 * the cycle spelled out — not hang the tab it was pasted into.
 */

import {
    emptyCombos,
    subtractCombos,
    unionCombos,
    countCombos,
    type ComboSet,
} from './comboSet.ts';
import { parseHands } from './parse.ts';
import type { RangeSet } from '../ontology/types.ts';

export class RangeCycleError extends Error {
    constructor(readonly cycle: readonly string[]) {
        super(`range_set derivation forms a cycle: ${cycle.join(' -> ')}`);
        this.name = 'RangeCycleError';
    }
}

export class UnknownParentError extends Error {
    constructor(readonly id: string, readonly parent: string) {
        super(`range_set "${id}" derives from "${parent}", which does not exist`);
        this.name = 'UnknownParentError';
    }
}

export class EmptyRangeError extends Error {
    constructor(readonly id: string) {
        super(`range_set "${id}" excludes everything it contains, leaving no hands`);
        this.name = 'EmptyRangeError';
    }
}

/**
 * Expands every set, resolving `derived_from` chains.
 *
 * Returns a map so the generator can look a range up by id without re-parsing
 * on every scenario — expansion happens once per import, not once per drill.
 */
export function expandRangeSets(sets: readonly RangeSet[]): Map<string, ComboSet> {
    const byId = new Map(sets.map((set) => [set.id, set]));
    const resolved = new Map<string, ComboSet>();
    const inProgress: string[] = [];

    const resolve = (id: string): ComboSet => {
        const cached = resolved.get(id);
        if (cached !== undefined) return cached;

        const cycleAt = inProgress.indexOf(id);
        if (cycleAt !== -1) throw new RangeCycleError([...inProgress.slice(cycleAt), id]);

        // Every id asked for is a set's own id or a parent checked just below.
        const set = byId.get(id);
        if (set === undefined) throw new Error(`range_set "${id}" is not in this payload`);
        inProgress.push(id);

        let combos = emptyCombos();
        if (set.derived_from !== undefined) {
            if (!byId.has(set.derived_from)) throw new UnknownParentError(id, set.derived_from);
            combos = resolve(set.derived_from);
        }

        combos = unionCombos(combos, parseHands(set.hands));
        if (set.excludes !== undefined && set.excludes.length > 0) {
            combos = subtractCombos(combos, parseHands(set.excludes));
        }

        if (countCombos(combos) === 0) throw new EmptyRangeError(id);

        inProgress.pop();
        resolved.set(id, combos);
        return combos;
    };

    sets.forEach((set) => resolve(set.id));
    return resolved;
}
