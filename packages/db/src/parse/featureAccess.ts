/**
 * Turns my_feature_access() rows into what FeatureGate renders. The type has the same shape as
 * FeatureAccess in @rivr/ui, which db may not import (docs/decisions/0010).
 */

/** How one feature shows for the signed-in member. */
export type FeatureAccess =
  | { readonly state: 'enabled' }
  | { readonly state: 'locked'; readonly tiers: readonly string[] }
  | { readonly state: 'hidden' };

/** One row of my_feature_access(), as the API returns it. */
export interface FeatureAccessRow {
  readonly feature_key: string;
  readonly state: string;
  readonly tiers: readonly string[] | null;
}

/** While access is unknown (loading, signed out, unknown key) an entry point does not render. */
export const HIDDEN: FeatureAccess = { state: 'hidden' };

/** One row's access. An unrecognised state is treated as hidden, the safe reading. */
export function toFeatureAccess(row: FeatureAccessRow): FeatureAccess {
  switch (row.state) {
    case 'enabled':
      return { state: 'enabled' };
    case 'locked':
      return { state: 'locked', tiers: row.tiers ?? [] };
    default:
      return HIDDEN;
  }
}

/** Every row's access, by feature key. */
export function toFeatureAccessMap(rows: readonly FeatureAccessRow[]): ReadonlyMap<string, FeatureAccess> {
  return new Map(rows.map((row) => [row.feature_key, toFeatureAccess(row)]));
}
