/**
 * What a reader chose to drill.
 *
 * The queue alone decides by memory, with no way to say "the chapter I just
 * read" or "the thing I keep getting wrong". That is the right DEFAULT and the
 * wrong cage — somebody who has just finished the board texture chapter wants
 * board texture now, not in four days.
 *
 * So a scope narrows the pool BEFORE the scheduler orders it. Due-ness still
 * decides what comes first within the scope, which keeps spacing meaningful
 * while letting the reader aim it.
 *
 * **Facets, not a mode.** One `mode` and one `value` would make every choice
 * exclusive: turn spots at 5-10, or the chapter you just read at any stakes,
 * never both. Selections accumulate the way a filter panel's do, and an empty
 * scope is everything, which keeps "Continue" a one-tap common case.
 *
 * Every facet reads coordinates the ontology already carries. Nothing here needs
 * a new field on a principle except `source_unit_id`, which the schema has
 * defined since 1.0.
 */

import type { GameTexture, OntologyPayload, Principle, Stakes, Street } from '../ontology/types.ts';
import { situationStreets, STREET_NAMES } from '../ontology/types.ts';
import { effectiveRule } from '../grading/resolve.ts';

export interface DrillScope {
    /** `source_unit_id`s — the source's own chapters. */
    readonly units?: readonly string[] | undefined;
    readonly streets?: readonly Street[] | undefined;
    readonly stakes?: readonly Stakes[] | undefined;
    /** Only the principles this reader is measurably worse at. */
    readonly leaksOnly?: boolean | undefined;
    /**
     * What the table is like — the one facet that changes ANSWERS rather than
     * the pool. A source's `modifiers` key on it (a wider value range in a
     * loose, passive game, say), and without a way to set it those teachings
     * could never fire. Undefined is the ordinary game and changes nothing.
     */
    readonly game?: GameTexture | undefined;
}

/**
 * The textures a source's modifiers actually answer to — offered on the hub,
 * so a reader is never shown a choice that would change nothing.
 */
export function gameTexturesOf(payload: OntologyPayload): GameTexture[] {
    const seen = new Set<GameTexture>();
    for (const principle of payload.principles) {
        for (const modifier of principle.modifiers ?? []) {
            if (modifier.when.game_texture !== undefined) seen.add(modifier.when.game_texture);
        }
    }
    return [...seen];
}

/** How the hub names a texture. */
export const GAME_TEXTURE_LABELS: Readonly<Record<GameTexture, string>> = {
    loose_passive: 'Loose and passive',
    loose_aggressive: 'Loose and aggressive',
    tight_passive: 'Tight and passive',
    tight_aggressive: 'Tight and aggressive',
    fold_happy: 'Folds too much',
    station_heavy: 'Full of calling stations',
};

/** Everything, in due order. The default and the common case. */
export const DUE_SCOPE: DrillScope = {};

/** How many spots a session asks for. `null` means keep going. */
export type SessionLength = number | null;

export const SESSION_LENGTHS: readonly SessionLength[] = [10, 20, 40, null];

/** How many facets are narrowing the pool — for the panel's "N active" badge. */
export function activeFacets(scope: DrillScope): number {
    return (scope.units?.length ?? 0) + (scope.streets?.length ?? 0)
        + (scope.stakes?.length ?? 0) + (scope.leaksOnly === true ? 1 : 0)
        + (scope.game === undefined ? 0 : 1);
}

/** Whether a facet narrows at all: absent and empty both mean "everything". */
const narrows = <T>(facet: readonly T[] | undefined): facet is readonly T[] =>
    facet !== undefined && facet.length > 0;

/**
 * Whether a rule's coordinate meets the wanted values. An unscoped rule plays
 * everywhere, so it belongs to each of them — the same reading the matcher
 * gives an omitted coordinate, rather than treating silence as exclusion.
 */
const overlaps = <T>(ruleValues: readonly T[] | undefined, wanted: readonly T[]): boolean =>
    ruleValues === undefined || ruleValues.some((value) => wanted.includes(value));

/**
 * Does this principle belong to the chosen scope?
 *
 * AND across facets, OR within one: "the barrelling chapter, on the turn" is an
 * intersection, and "the turn or the river" is a union, as in any filter bar.
 */
export function inScope(principle: Principle, scope: DrillScope, leaks: readonly string[]): boolean {
    if (scope.leaksOnly === true && !leaks.includes(principle.id)) return false;
    if (narrows(scope.units) && !scope.units.includes(principle.source_unit_id ?? '')) return false;

    const { rule } = effectiveRule(principle);
    if (narrows(scope.streets) && !overlaps(situationStreets(rule.situation), scope.streets)) return false;
    return !narrows(scope.stakes) || overlaps(rule.situation.stakes, scope.stakes);
}

/** Human wording for a scope, for the session header and the summary. */
export function describeScope(
    scope: DrillScope,
    unitLabel: (id: string) => string | undefined,
): string {
    const parts: string[] = [];

    if (scope.leaksOnly === true) parts.push('your leaks');
    for (const unit of scope.units ?? []) parts.push(unitLabel(unit) ?? unit);
    if (narrows(scope.streets)) parts.push(scope.streets.map((street) => STREET_NAMES[street]).join(' & '));
    if (narrows(scope.stakes)) parts.push(`${scope.stakes.join(' & ')} games`);
    if (scope.game !== undefined) parts.push(`${GAME_TEXTURE_LABELS[scope.game].toLowerCase()} table`);

    return parts.length === 0 ? 'Everything due' : parts.join(' · ');
}
