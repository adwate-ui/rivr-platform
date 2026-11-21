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

/** A CSV file's lines as fields, without its byte-order mark: the nth row is the file's line n, an empty line an empty field. */
export function csvRows(text: string): string[][] {
  const body = text.startsWith(BYTE_ORDER_MARK) ? text.slice(1) : text;
  return body.split(/\r?\n/).map(csvFields);
}
