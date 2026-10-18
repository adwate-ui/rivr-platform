/**
 * Which board tags can appear together.
 *
 * Derived by asking the boards themselves, not by writing down a table. Two
 * tags are incompatible exactly when no board carries both, and the only way to
 * be sure of that is to look — a hand-written table is a set of claims about
 * `boardTexture.ts` that nothing keeps true when its predicates change.
 *
 * **Texture is a property of the FLOP.** That is the source vocabulary the
 * tags mirror — "a static flop", "a dynamic flop" — and it is how the generator
 * and the quiz harness tag a scenario on every street (see `matchesBoard` in
 * `generator/scenario.ts`); a turn or river card that changes the picture is
 * the runout's news to carry. So the question "can these tags co-occur on the
 * turn?" is the same question as on the flop, and the flop is enumerated
 * EXHAUSTIVELY — all 1,755 distinct boards — so every answer here is proven.
 * Until this module agreed with the generator it sampled full turn and river
 * boards, which let a rule demand `flush_complete` on the river, pass stage 4
 * as satisfiable, and then generate nothing.
 */
import type { BoardTag } from '../ontology/types.ts';
import { boardTags } from '../boardTexture.ts';
import { canonicalFlops } from '../boardEnumeration.ts';

export type Realisability = 'realisable' | 'impossible';

let cache: readonly Set<BoardTag>[] | undefined;

/** Distinct tag-sets a flop can carry. Built once, then reused. */
function signatures(): readonly Set<BoardTag>[] {
    if (cache !== undefined) return cache;

    const seen = new Map<string, Set<BoardTag>>();
    canonicalFlops().forEach(({ flop }) => {
        const tags = boardTags(flop);
        const key = tags.join(',');
        if (!seen.has(key)) seen.set(key, new Set(tags));
    });

    cache = [...seen.values()];
    return cache;
}

/** Whether some single flop can carry every one of `required` at once. */
export function jointRealisability(required: readonly BoardTag[]): Realisability {
    if (required.length === 0) return 'realisable';
    return signatures().some((tags) => required.every((tag) => tags.has(tag))) ? 'realisable' : 'impossible';
}

/** Test seam: forget what has been derived so a run starts cold. */
export function resetTagCompatibilityCache(): void {
    cache = undefined;
}
