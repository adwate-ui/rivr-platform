/** The byte-order mark a spreadsheet may write first, so ₹ reads as UTF-8. */
const BYTE_ORDER_MARK = String.fromCharCode(0xfeff);

/** A CSV line's fields: commas part them, and a field in double quotes may hold a comma, with "" for a quote. Each is trimmed. */
export function csvFields(line: string): string[] {
  const fields: string[] = [];
  let field = '';
  let isQuoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line.charAt(index);
    if (char === '"' && isQuoted && line.charAt(index + 1) === '"') {
      field += '"';
      index += 1;
    } else if (char === '"') {
      isQuoted = !isQuoted;
    } else if (char === ',' && !isQuoted) {
      fields.push(field.trim());
      field = '';
    } else {
      field += char;
    }
  }
  fields.push(field.trim());
  return fields;
}

/** The file's lines, each with whether it ends inside a quoted field (a cell typed over several lines, as Alt+Enter makes). */
function linesOf(text: string): { readonly text: string; readonly endsQuoted: boolean }[] {
  let isQuoted = false;
  return text.split(/\r?\n/).map((line) => {
    for (const char of line) if (char === '"') isQuoted = !isQuoted;
    return { text: line, endsQuoted: isQuoted };
  });
}

/**
 * A CSV file's records as fields, without its byte-order mark. A record is on the line it starts on, so the nth row is the
 * file's line n: a quoted cell over several lines keeps its line breaks, and the lines it runs on are empty rows.
 */
export function csvRows(text: string): string[][] {
  const body = text.startsWith(BYTE_ORDER_MARK) ? text.slice(1) : text;
  const rows: string[][] = [];
  let record: string[] = [];
  for (const line of linesOf(body)) {
    record.push(line.text);
    if (line.endsQuoted) continue;
    rows.push(csvFields(record.join('\n')), ...record.slice(1).map(() => ['']));
    record = [];
  }
  if (record.length > 0) rows.push(csvFields(record.join('\n')), ...record.slice(1).map(() => ['']));
  return rows;
}
