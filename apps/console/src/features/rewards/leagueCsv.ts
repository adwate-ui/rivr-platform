/** One member's League points from a CSV: their number, the points, and the line they came from. */
export interface LeagueCsvRow {
  readonly memberNumber: number;
  readonly points: bigint;
  readonly line: number;
}

/** What is wrong with the file: a line that is not a number and points, a member listed again, too many rows, or none. */
export type LeagueCsvProblem =
  | { readonly kind: 'badLine'; readonly line: number }
  | { readonly kind: 'twice'; readonly line: number; readonly number: number }
  | { readonly kind: 'tooMany' }
  | { readonly kind: 'empty' };

export interface LeagueCsv {
  readonly rows: readonly LeagueCsvRow[];
  readonly problems: readonly LeagueCsvProblem[];
}

// As give_league_points allows: 1 to 500 members, 1 to 10,00,000 points each.
const MOST_ROWS = 500;
const MOST_POINTS = 1_000_000n;

/** A cell without its quotes and spaces. */
const cell = (text: string | undefined) => (text ?? '').trim().replace(/^"(.*)"$/, '$1').trim();

/** A line's two cells, split at a comma, semicolon or tab, as spreadsheets save them. */
const cellsOf = (line: string) => line.split(/[,;\t]/).map(cell);

/** The first line names the columns when its first cell is not a number. */
const isHeading = (line: string) => !/^\d/.test(cellsOf(line)[0] ?? '');

/** One line as a row, or null when it is not a member number and 1 to 10,00,000 points. */
function rowOf(text: string, line: number): LeagueCsvRow | null {
  const [number, points, ...rest] = cellsOf(text);
  if (rest.some((extra) => extra !== '') || !/^\d{1,9}$/.test(number ?? '') || !/^\d{1,7}$/.test(points ?? '')) return null;
  const amount = BigInt(points ?? '0');
  return amount >= 1n && amount <= MOST_POINTS ? { memberNumber: Number(number), points: amount, line } : null;
}

/**
 * League points from a CSV of member numbers and points (L-01): a first line of headings is skipped, blank lines too,
 * and every line that is not a member number and its points is a problem, as is a member listed twice. Nothing is given
 * while the file has a problem.
 */
export function parseLeagueCsv(text: string): LeagueCsv {
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/).map((line, index) => ({ text: line, line: index + 1 })).filter((line) => line.text.trim() !== '');
  const body = lines[0] !== undefined && isHeading(lines[0].text) ? lines.slice(1) : lines;
  const rows: LeagueCsvRow[] = [];
  const problems: LeagueCsvProblem[] = [];
  const seen = new Set<number>();
  for (const { text: lineText, line } of body) {
    const row = rowOf(lineText, line);
    if (row === null) problems.push({ kind: 'badLine', line });
    else if (seen.has(row.memberNumber)) problems.push({ kind: 'twice', line, number: row.memberNumber });
    else {
      seen.add(row.memberNumber);
      rows.push(row);
    }
  }
  if (rows.length > MOST_ROWS) problems.push({ kind: 'tooMany' });
  if (body.length === 0) problems.push({ kind: 'empty' });
  return { rows, problems };
}
