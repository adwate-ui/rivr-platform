/**
 * How the gates print. Through standard output rather than the console, so a
 * gate's report is plain text a CI log keeps and a person can read top to bottom.
 */

let sink = (line: string): void => {
    process.stdout.write(`${line}\n`);
};

/** Writes one line of a gate's report. */
export function say(line = ''): void {
    sink(line);
}

/** Runs `work` with every line it says kept rather than printed: how the console shows an upload's report (#131). */
export function collecting<T>(work: () => T): { readonly result: T; readonly lines: readonly string[] } {
    const lines: string[] = [];
    const before = sink;
    sink = (line) => lines.push(line);
    try {
        return { result: work(), lines };
    } finally {
        sink = before;
    }
}

/** A share as a percentage with one decimal. */
export const pct = (value: number): string => `${(value * 100).toFixed(1)}%`;

/** A part of a whole as a percentage, or a dash when there is no whole to share. */
export const share = (part: number, whole: number): string => (whole === 0 ? '—' : pct(part / whole));

/** Adds one to a tally kept by key. */
export function bump(tally: Map<string, number>, key: string): void {
    tally.set(key, (tally.get(key) ?? 0) + 1);
}

type Cell = string | number | boolean | null | undefined;

const cellText = (cell: Cell): string => (cell === null || cell === undefined ? '—' : String(cell));

/** Fixed-width columns, so a terminal lines them up without a table library. */
export function table(rows: readonly Readonly<Record<string, Cell>>[], columns: readonly string[]): string {
    const widths = columns.map((column) =>
        Math.max(column.length, ...rows.map((row) => cellText(row[column]).length)));
    const line = (cells: readonly string[]): string =>
        `  ${cells.map((cell, index) => cell.padEnd(widths[index] ?? 0)).join('  ')}`;
    return [
        line(columns),
        line(widths.map((width) => '-'.repeat(width))),
        ...rows.map((row) => line(columns.map((column) => cellText(row[column])))),
    ].join('\n');
}
