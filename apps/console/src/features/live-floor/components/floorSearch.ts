/** The seat a link asks the Live floor to show: a member record's Show, `/?table=<table id>&seat=<n>`. */
export interface FloorFocus {
  readonly table?: string;
  readonly seat?: number;
}

/** The table and seat in the Live floor's address, when both are there and make sense; nothing otherwise. */
export function floorSearchFrom(search: Record<string, unknown>): FloorFocus {
  const table = typeof search['table'] === 'string' ? search['table'] : undefined;
  const seat = Number(search['seat']);
  return table !== undefined && Number.isInteger(seat) && seat > 0 ? { table, seat } : {};
}
