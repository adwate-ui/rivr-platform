/** Why a table may not be deactivated or deleted now (decision 0432): someone sits at it, or waits on its list. */
export type TableRetireRefusal = 'players_seated' | 'players_waiting';

/** Who keeps a table in play: the players seated at it, and the places waiting on its list or called to it. */
export interface TableInPlay {
  readonly seated: number;
  readonly waiting: number;
}

/**
 * Whether a table may be deactivated or deleted, and if not why: never while a player sits at it, then never while a place
 * waits on its list. Null when it may. `private.assert_table_empty` refuses with the same reasons, in the same order
 * (RVSTD, then RVWTG).
 */
export function tableRetireRefusal({ seated, waiting }: TableInPlay): TableRetireRefusal | null {
  if (seated > 0) return 'players_seated';
  return waiting > 0 ? 'players_waiting' : null;
}
