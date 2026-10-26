import { describe, expect, it } from 'vitest';
import { crc32, csvFile, xlsxFile, zipStored } from './exportFiles.ts';

/** The names of the files in a zip archive, from its central directory. */
function zipNames(bytes: Uint8Array): string[] {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const end = bytes.length - 22;
  expect(view.getUint32(end, true)).toBe(0x06054b50);
  const count = view.getUint16(end + 10, true);
  let at = view.getUint32(end + 16, true);
  const names: string[] = [];
  for (let index = 0; index < count; index += 1) {
    expect(view.getUint32(at, true)).toBe(0x02014b50);
    const nameLength = view.getUint16(at + 28, true);
    names.push(new TextDecoder().decode(bytes.subarray(at + 46, at + 46 + nameLength)));
    at += 46 + nameLength;
  }
  return names;
}

describe('the export files', () => {
  it('quotes every CSV cell, keeps formulas as text, and starts with the byte-order mark', async () => {
    const file = csvFile(['Member', 'Owed'], [['=SUM(A1)', 1234.5], ['Say "hi"', 0]]);
    const bytes = new Uint8Array(await file.arrayBuffer());
    expect([...bytes.subarray(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
    expect(new TextDecoder().decode(bytes.subarray(3))).toBe('"Member","Owed"\r\n"\'=SUM(A1)",1234.5\r\n"Say ""hi""",0\r\n');
  });

  it('checks each zip part with CRC-32, as the standard check value says', () => {
    expect(crc32(new TextEncoder().encode('123456789'))).toBe(0xcbf43926);
  });

  it('stores the parts of a workbook in a zip a spreadsheet opens', () => {
    expect(zipNames(zipStored({ 'a.txt': 'A', 'folder/b.xml': '<b/>' }))).toEqual(['a.txt', 'folder/b.xml']);
  });

  it('writes an XLSX of one sheet: words as text, figures as numbers, names escaped', async () => {
    const file = xlsxFile('Open markers: November', ['Member', 'Owed'], [['Kabir & Co <K>', 1234.5]]);
    const bytes = new Uint8Array(await file.arrayBuffer());
    expect(zipNames(bytes)).toEqual(['[Content_Types].xml', '_rels/.rels', 'xl/workbook.xml', 'xl/_rels/workbook.xml.rels', 'xl/worksheets/sheet1.xml']);
    const text = new TextDecoder().decode(bytes);
    expect(text).toContain('<sheet name="Open markers  November"');
    expect(text).toContain('<t xml:space="preserve">Kabir &amp; Co &lt;K&gt;</t>');
    expect(text).toContain('<c><v>1234.5</v></c>');
  });
});
