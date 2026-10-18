/**
 * The gates' allowlists: findings an encoding has adjudicated, with the reason.
 *
 * Keyed by `source.id`, because a reason belongs to one source; a source with
 * no entry has nothing excused. All empty: the only encodings in this
 * repository are invented fixtures that need no excuse, and an entry for a
 * licensed source would carry its citations into a public repository.
 *
 * A key naming no source in the run is a rename that silently emptied an
 * allowlist, so `staleAllowlistSources` fails the run at any state.
 */

export type Allowlist = ReadonlyMap<string, string>;
export type AllowlistTable = Readonly<Record<string, Allowlist>>;

/** `lines`: rules a source states for any line, so their example's line need not be pinned. */
export const LINES_ALLOWED: AllowlistTable = {};

/** `overclaim`: rules a source states for every hand, so answering without reading it is intended. */
export const OVERCLAIM_ALLOWED: AllowlistTable = {};

/** `mece`: width-decided disagreements, keyed by the two rule ids sorted and joined with ' | '. */
export const MECE_WIDTH_ALLOWED: AllowlistTable = {};

/** `mece`: tied-width disagreements. Order-decided answers are always a defect; this stays empty. */
export const MECE_TIED_ALLOWED: AllowlistTable = {};

/** `mece`: turn and river rules a source states for any card. */
export const MECE_RUNOUT_FREE_ALLOWED: AllowlistTable = {};

const ALL_TABLES: readonly AllowlistTable[] = [
    LINES_ALLOWED, OVERCLAIM_ALLOWED, MECE_WIDTH_ALLOWED, MECE_TIED_ALLOWED, MECE_RUNOUT_FREE_ALLOWED,
];

const EMPTY: Allowlist = new Map();

/** One source's allowlist from a table; a source with no entry gets an empty one. */
export const allowlistFor = (table: AllowlistTable, sourceId: string): Allowlist => table[sourceId] ?? EMPTY;

/** Allowlist keys that name no source this run knows, sorted. */
export function staleAllowlistSources(knownSourceIds: readonly string[]): string[] {
    const known = new Set(knownSourceIds);
    const keys = ALL_TABLES.flatMap((table) => Object.keys(table));
    return [...new Set(keys.filter((id) => !known.has(id)))].sort();
}
