import type { ReactNode } from 'react';

/**
 * What a row opened in place (console v3), under it across the table: a row of one cell spanning every column. In the
 * scroll layout below 768 px it is held in view as the lines scroll sideways, so its form is never cut off.
 */
export function OpenedRow({ index, columns, children }: { index: number; columns: number; children: ReactNode }) {
  return (
    <div role="row" aria-rowindex={index + 2} className="border-b border-hairline px-3 pt-1 pb-4 max-medium:sticky max-medium:left-0">
      <div role="cell" aria-colspan={columns} className="min-w-0">{children}</div>
    </div>
  );
}

/** Each row's place among the rows drawn, a detail taking a place of its own after its row: [0, 1, 3] when the second has one. */
export function placesOf(details: readonly ReactNode[]): number[] {
  return details.reduce<number[]>((places, _detail, at) => [...places, at === 0 ? 0 : (places[at - 1] ?? 0) + (details[at - 1] === null ? 1 : 2)], []);
}
