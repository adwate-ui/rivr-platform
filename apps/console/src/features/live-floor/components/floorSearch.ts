/** The seat a link asks the Live floor to show: a member record's Show, `/?table=<table id>&seat=<n>`. */
export interface FloorFocus {
  readonly table?: string;
  readonly seat?: number;
  /** `open`: the requests panel shows, whatever the window's width (audit F-078). */
  readonly panel?: 'open';
}

/** The table and seat in the Live floor's address, when both are there and make sense; nothing otherwise. */
export function floorSearchFrom(search: Record<string, unknown>): FloorFocus {
  const table = typeof search['table'] === 'string' ? search['table'] : undefined;
  const seat = Number(search['seat']);
  const panel = search['panel'] === 'open' ? { panel: 'open' as const } : {};
  return table !== undefined && Number.isInteger(seat) && seat > 0 ? { table, seat, ...panel } : panel;
}
