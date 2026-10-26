/** A cell of an exported table: words, or a figure a spreadsheet can add up. */
export type ExportCell = string | number;

/**
 * A CSV cell, always quoted (quotes doubled), so no separator a spreadsheet might use splits it; text a
 * spreadsheet would read as a formula (`=`, `+`, `-`, `@`) is kept as text with a leading apostrophe.
 */
function csvCell(cell: ExportCell): string {
  if (typeof cell === 'number') return String(cell);
  const safe = /^[=+\-@\t\r]/.test(cell) ? `'${cell}` : cell;
  return `"${safe.replaceAll('"', '""')}"`;
}

/**
 * A table as a CSV file (#102): the byte-order mark, so a spreadsheet reads it as UTF-8 and ₹ stays ₹,
 * then the headers and the rows, each line ending in CRLF.
 */
export function csvFile(headers: readonly string[], rows: readonly (readonly ExportCell[])[]): Blob {
  const text = [headers, ...rows].map((row) => row.map(csvCell).join(',')).join('\r\n');
  return new Blob(['﻿', text, '\r\n'], { type: 'text/csv;charset=utf-8' });
}

const XML_ESCAPES: Readonly<Record<string, string>> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' };
// Control characters other than tab, line feed and carriage return cannot appear in XML at all.
const isXmlCharacter = (character: string) => character >= ' ' || character === '\t' || character === '\n' || character === '\r';
const escapeXml = (text: string) => [...text].filter(isXmlCharacter).join('').replace(/[&<>"]/g, (character) => XML_ESCAPES[character] ?? character);

/** A row of the sheet: words as inline strings, figures as numbers. */
function sheetRow(cells: readonly ExportCell[], index: number): string {
  const xml = cells.map((cell) => (typeof cell === 'number'
    ? `<c><v>${cell}</v></c>`
    : `<c t="inlineStr"><is><t xml:space="preserve">${escapeXml(cell)}</t></is></c>`));
  return `<row r="${index + 1}">${xml.join('')}</row>`;
}

/** The smallest set of parts a spreadsheet opens as a workbook of one sheet. */
function workbookParts(sheetName: string, rows: readonly (readonly ExportCell[])[]): Record<string, string> {
  const xml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
  const main = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
  const relationships = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
  const packageRelationships = 'http://schemas.openxmlformats.org/package/2006/relationships';
  return {
    '[Content_Types].xml': `${xml}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">`
      + '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
      + '<Default Extension="xml" ContentType="application/xml"/>'
      + '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>'
      + '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>',
    '_rels/.rels': `${xml}<Relationships xmlns="${packageRelationships}">`
      + `<Relationship Id="rId1" Type="${relationships}/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
    'xl/workbook.xml': `${xml}<workbook xmlns="${main}" xmlns:r="${relationships}"><sheets>`
      + `<sheet name="${escapeXml(sheetName)}" sheetId="1" r:id="rId1"/></sheets></workbook>`,
    'xl/_rels/workbook.xml.rels': `${xml}<Relationships xmlns="${packageRelationships}">`
      + `<Relationship Id="rId1" Type="${relationships}/worksheet" Target="worksheets/sheet1.xml"/></Relationships>`,
    'xl/worksheets/sheet1.xml': `${xml}<worksheet xmlns="${main}"><sheetData>${rows.map(sheetRow).join('')}</sheetData></worksheet>`,
  };
}

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let bit = 0; bit < 8; bit += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

/** The CRC-32 a zip file records for each part: `123456789` is 0xCBF43926. */
export function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = (CRC_TABLE[(crc ^ byte) & 0xff] ?? 0) ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

/** Little-endian fields of a zip header: [value, bytes] pairs. */
function fields(...values: readonly (readonly [number, 2 | 4])[]): Uint8Array {
  const out = new Uint8Array(values.reduce((size, [, bytes]) => size + bytes, 0));
  const view = new DataView(out.buffer);
  let at = 0;
  for (const [value, bytes] of values) {
    if (bytes === 2) view.setUint16(at, value, true);
    else view.setUint32(at, value, true);
    at += bytes;
  }
  return out;
}

/**
 * Files stored, not compressed, in a zip archive: each part's local header and bytes, then the central
 * directory and its end record. Small exports need no compression, and this needs no library. A part is
 * text (written as UTF-8) or bytes, such as a photo.
 */
export function zipStored(files: Readonly<Record<string, string | Uint8Array>>): Uint8Array<ArrayBuffer> {
  const encoder = new TextEncoder();
  const local: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;
  for (const [name, content] of Object.entries(files)) {
    const nameBytes = encoder.encode(name);
    const data = typeof content === 'string' ? encoder.encode(content) : content;
    const crc = crc32(data);
    // Version 2.0, flag 0x0800 (UTF-8 names), stored, no date.
    const common = [[20, 2], [0x0800, 2], [0, 2], [0, 2], [0, 2], [crc, 4], [data.length, 4], [data.length, 4], [nameBytes.length, 2], [0, 2]] as const;
    const header = fields([0x04034b50, 4], ...common);
    local.push(header, nameBytes, data);
    central.push(fields([0x02014b50, 4], [20, 2], ...common, [0, 2], [0, 2], [0, 2], [0, 4], [offset, 4]), nameBytes);
    offset += header.length + nameBytes.length + data.length;
  }
  const directorySize = central.reduce((size, part) => size + part.length, 0);
  const count = Object.keys(files).length;
  const end = fields([0x06054b50, 4], [0, 2], [0, 2], [count, 2], [count, 2], [directorySize, 4], [offset, 4], [0, 2]);
  const parts = [...local, ...central, end];
  const out = new Uint8Array(new ArrayBuffer(parts.reduce((size, part) => size + part.length, 0)));
  let at = 0;
  for (const part of parts) {
    out.set(part, at);
    at += part.length;
  }
  return out;
}

/** Saves a file through the browser's download, under the name given. */
export function saveFile(file: Blob, name: string) {
  const url = URL.createObjectURL(file);
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.click();
  globalThis.setTimeout(() => URL.revokeObjectURL(url), 0);
}

/** A table as an XLSX workbook of one sheet (#102): the headers, then the rows; figures stay numbers. */
export function xlsxFile(sheetName: string, headers: readonly string[], rows: readonly (readonly ExportCell[])[]): Blob {
  // A sheet's name is at most 31 characters, none of []:*?/\.
  const name = sheetName.replace(/[[\]:*?/\\]/g, ' ').slice(0, 31) || 'Sheet1';
  return new Blob([zipStored(workbookParts(name, [headers, ...rows]))], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}
