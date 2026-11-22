/** The byte-order mark a spreadsheet may write first, so ₹ reads as UTF-8. */
const BYTE_ORDER_MARK = String.fromCharCode(0xfeff);

/** A record of a CSV file: its fields, and the line it starts on. */
interface CsvRecord {
  readonly line: number;
  readonly fields: string[];
}

/** Where the scan is: the records so far, the current record's fields and field, and whether the field is quoted. */
interface Scan {
  readonly records: CsvRecord[];
  fields: string[];
  field: string;
  isQuoted: boolean;
  hasStarted: boolean;
  line: number;
  startLine: number;
}

/** Ends the field, and the record with it when `isRecordEnd`. */
function endField(scan: Scan, isRecordEnd: boolean) {
  scan.fields.push(scan.field.trim());
  scan.field = '';
  scan.hasStarted = false;
  if (!isRecordEnd) return;
  scan.records.push({ line: scan.startLine, fields: scan.fields });
  scan.fields = [];
  scan.line += 1;
  scan.startLine = scan.line;
}

/** One character inside quotes: "" is a quote, " ends the quotes, and anything else, a line break among it, is kept. */
function inQuotes(scan: Scan, text: string, index: number): number {
  const char = text.charAt(index);
  if (char === '"' && text.charAt(index + 1) === '"') {
    scan.field += '"';
    return index + 1;
  }
  if (char === '"') scan.isQuoted = false;
  else if (char === '\r' && text.charAt(index + 1) === '\n') return index;
  else {
    if (char === '\n') scan.line += 1;
    scan.field += char;
  }
  return index;
}

/** One character outside quotes: a comma ends the field, a line break the record, a quote first in a field opens quotes. */
function outsideQuotes(scan: Scan, text: string, index: number): number {
  const char = text.charAt(index);
  if (char === ',') {
    endField(scan, false);
    return index;
  }
  if (char === '\n' || char === '\r') {
    const last = char === '\r' && text.charAt(index + 1) === '\n' ? index + 1 : index;
    endField(scan, true);
    return last;
  }
  if (char === '"' && !scan.hasStarted) scan.isQuoted = true;
  else scan.field += char;
  if (char.trim() !== '') scan.hasStarted = true;
  return index;
}

/**
 * A CSV text's records, each with the line it starts on. Commas part fields, a line break ends a record, and a field is
 * quoted only when its first character other than a space is a double quote, as spreadsheets write them: inside, "" is a
 * quote and line breaks are kept; a quote anywhere else is a quote. One pass, as long as the text.
 */
function csvRecords(text: string): CsvRecord[] {
  const scan: Scan = { records: [], fields: [], field: '', isQuoted: false, hasStarted: false, line: 1, startLine: 1 };
  for (let index = 0; index < text.length; index += 1) {
    index = scan.isQuoted ? inQuotes(scan, text, index) : outsideQuotes(scan, text, index);
  }
  endField(scan, true);
  return scan.records;
}

/** A CSV line's fields: commas part them, and a field in double quotes may hold a comma, with "" for a quote. Each is trimmed. */
export function csvFields(line: string): string[] {
  return csvRecords(line)[0]?.fields ?? [''];
}

/**
 * A CSV file's records as fields, without its byte-order mark. A record is on the line it starts on, so the nth row is the
 * file's line n: a quoted cell over several lines keeps its line breaks, and the lines it runs on are empty rows.
 */
export function csvRows(text: string): string[][] {
  const body = text.startsWith(BYTE_ORDER_MARK) ? text.slice(1) : text;
  const rows: string[][] = [];
  for (const record of csvRecords(body)) {
    while (rows.length < record.line - 1) rows.push(['']);
    rows.push(record.fields);
  }
  return rows;
}
