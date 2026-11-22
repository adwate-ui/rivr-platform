import { describe, expect, it } from 'vitest';
import { xlsxFile, zipStored } from '../DataTable/exportFiles.ts';
import { csvFields } from './csv.ts';
import { readSheetFile } from './readSheetFile.ts';
import { MOST_SHEET_ROWS } from './xlsx.ts';

const MB = 1_048_576;
const MAIN = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
const RELATIONS = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';

/** Text deflated as a zip part is. */
async function deflated(text: string): Promise<Uint8Array<ArrayBuffer>> {
  const source = new ReadableStream<Uint8Array<ArrayBuffer>>({ start(controller) { controller.enqueue(new TextEncoder().encode(text)); controller.close(); } });
  const compressed = source.pipeThrough(new CompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(compressed).arrayBuffer());
}

/** A zip archive of deflated parts, as a spreadsheet saves it (the reader checks no CRC). */
async function zipDeflated(parts: Readonly<Record<string, string>>): Promise<Uint8Array<ArrayBuffer>> {
  const chunks: number[] = [];
  const central: number[] = [];
  const fields = (...values: [number, 2 | 4][]) => values.flatMap(([value, bytes]) => Array.from({ length: bytes }, (_, index) => (value >>> (8 * index)) & 0xff));
  for (const [name, text] of Object.entries(parts)) {
    const data = await deflated(text);
    const nameBytes = [...new TextEncoder().encode(name)];
    const common: [number, 2 | 4][] = [[20, 2], [0, 2], [8, 2], [0, 2], [0, 2], [0, 4], [data.length, 4], [new TextEncoder().encode(text).length, 4], [nameBytes.length, 2], [0, 2]];
    central.push(...fields([0x02014b50, 4], [20, 2], ...common, [0, 2], [0, 2], [0, 2], [0, 4], [chunks.length, 4]), ...nameBytes);
    chunks.push(...fields([0x04034b50, 4], ...common), ...nameBytes, ...data);
  }
  const count = Object.keys(parts).length;
  const end = fields([0x06054b50, 4], [0, 2], [0, 2], [count, 2], [count, 2], [central.length, 4], [chunks.length, 4], [0, 2]);
  return new Uint8Array([...chunks, ...central, ...end]);
}

/** A workbook with shared strings, a sheet named by its relationship, a skipped row and cell, and a number. */
function workbookParts(rows: string): Record<string, string> {
  return {
    'xl/workbook.xml': `<workbook xmlns="${MAIN}" xmlns:r="${RELATIONS}"><sheets><sheet name="Bonus" sheetId="1" r:id="rId7"/></sheets></workbook>`,
    'xl/_rels/workbook.xml.rels': '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
      + '<Relationship Id="rId7" Type="worksheet" Target="worksheets/bonus.xml"/></Relationships>',
    'xl/sharedStrings.xml': `<sst xmlns="${MAIN}"><si><t>Member</t></si><si><r><t>Diwali </t></r><r><t>gift</t></r></si><si><t>Add</t><rPh><t>x</t></rPh></si></sst>`,
    'xl/worksheets/bonus.xml': `<x:worksheet xmlns:x="${MAIN}"><x:sheetData>${rows}</x:sheetData></x:worksheet>`,
  };
}

describe('csvFields', () => {
  it('splits on commas, keeps a quoted comma, and reads "" as a quote', () => {
    expect(csvFields('a, "b, c" ,"say ""hi"""')).toEqual(['a', 'b, c', 'say "hi"']);
  });
});

describe('readSheetFile', () => {
  it('reads a CSV line by line, without its byte-order mark, an empty line kept in its place', async () => {
    const file = new Blob([`${String.fromCharCode(0xfeff)}Member,Chips\r\n1042,"2,000"\r\n\r\n9876543210,500`]);
    expect(await readSheetFile(file, MB)).toEqual({ ok: true, rows: [['Member', 'Chips'], ['1042', '2,000'], [''], ['9876543210', '500']] });
  });

  it('keeps a cell typed over several lines whole, on the line it starts, so the lines after keep their numbers', async () => {
    const file = new Blob(['Member,Reason\r\n1042,"Diwali\r\ngift, late"\r\n1043,Referral']);
    expect(await readSheetFile(file, MB)).toEqual({ ok: true, rows: [['Member', 'Reason'], ['1042', 'Diwali\ngift, late'], [''], ['1043', 'Referral']] });
    expect(await readSheetFile(new Blob(['1042,"never closed\r\nmore']), MB)).toEqual({ ok: true, rows: [['1042', 'never closed\nmore']] });
  });

  it('reads a quote inside a field as a quote, so a stray one never swallows the lines after it', async () => {
    const file = new Blob(['1234,add,500,5" screen\n1235,add,500,gift']);
    expect(await readSheetFile(file, MB)).toEqual({ ok: true, rows: [['1234', 'add', '500', '5" screen'], ['1235', 'add', '500', 'gift']] });
  });

  it('reads an unclosed quote over a great many lines without failing', async () => {
    const result = await readSheetFile(new Blob([`h\n"${'\n'.repeat(200_000)}`]), MB);
    expect(result.ok && result.rows.length).toBe(2);
  });

  it('reads the workbook the export writes: inline strings and figures', async () => {
    const file = xlsxFile('Bonus', ['Member', 'Chips'], [['Ritika Das', 2000], ['Kunal & Co <1>', 50]]);
    expect(await readSheetFile(file, MB)).toEqual({ ok: true, rows: [['Member', 'Chips'], ['Ritika Das', '2000'], ['Kunal & Co <1>', '50']] });
  });

  it('reads a deflated workbook\'s first sheet: shared strings, runs, a prefix, rows and cells it skips', async () => {
    const rows = '<x:row r="1"><x:c r="A1" t="s"><x:v>0</x:v></x:c><x:c r="C1" t="s"><x:v>2</x:v></x:c></x:row>'
      + '<x:row r="3"><x:c r="A3"><x:v>9876543210</x:v></x:c><x:c r="B3" t="s"><x:v>1</x:v></x:c><x:c r="C3" t="str"><x:v> 50 </x:v></x:c>'
      + '<x:c r="D3" t="b"><x:v>1</x:v></x:c><x:c r="E3" t="s"><x:v>99</x:v></x:c></x:row>';
    const file = new Blob([await zipDeflated(workbookParts(rows))]);
    expect(await readSheetFile(file, MB)).toEqual({ ok: true, rows: [['Member', '', 'Add'], [], ['9876543210', 'Diwali gift', '50', '1', '']] });
  });

  it('takes the usual sheet when the workbook names none, and cells with no reference in order', async () => {
    const file = new Blob([zipStored({ 'xl/worksheets/sheet1.xml': `<worksheet xmlns="${MAIN}"><sheetData><row><c t="inlineStr"><is><t>a</t></is></c><c><v>2</v></c></row></sheetData></worksheet>` })]);
    expect(await readSheetFile(file, MB)).toEqual({ ok: true, rows: [['a', '2']] });
  });

  it('refuses a file past the most bytes, an old Excel file, a zip with no sheet, a broken sheet, a DOCTYPE and a sheet past the most rows', async () => {
    expect(await readSheetFile(new Blob(['x'.repeat(11)]), 10)).toEqual({ ok: false, problem: 'tooBig' });
    expect(await readSheetFile(new Blob([new Uint8Array([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1, 0])]), MB)).toEqual({ ok: false, problem: 'unreadable' });
    expect(await readSheetFile(new Blob([zipStored({ 'word/document.xml': '<w/>' })]), MB)).toEqual({ ok: false, problem: 'unreadable' });
    expect(await readSheetFile(new Blob([zipStored({ 'xl/worksheets/sheet1.xml': '<worksheet' })]), MB)).toEqual({ ok: false, problem: 'unreadable' });
    expect(await readSheetFile(new Blob([new Uint8Array([0x50, 0x4b, 3, 4, 0, 0])]), MB)).toEqual({ ok: false, problem: 'unreadable' });
    const doctype = `<!DOCTYPE x [<!ENTITY a "aaaa">]><worksheet xmlns="${MAIN}"><sheetData><row><c><v>1</v></c></row></sheetData></worksheet>`;
    expect(await readSheetFile(new Blob([zipStored({ 'xl/worksheets/sheet1.xml': doctype })]), MB)).toEqual({ ok: false, problem: 'unreadable' });
    const far = `<worksheet xmlns="${MAIN}"><sheetData><row r="${MOST_SHEET_ROWS + 1}"><c><v>1</v></c></row></sheetData></worksheet>`;
    expect(await readSheetFile(new Blob([zipStored({ 'xl/worksheets/sheet1.xml': far })]), MB)).toEqual({ ok: false, problem: 'tooBig' });
    // Rows that all claim row 1 are counted as they come.
    const many = `<worksheet xmlns="${MAIN}"><sheetData>${'<row r="1"/>'.repeat(MOST_SHEET_ROWS + 1)}</sheetData></worksheet>`;
    expect(await readSheetFile(new Blob([zipStored({ 'xl/worksheets/sheet1.xml': many })]), MB)).toEqual({ ok: false, problem: 'tooBig' });
    const strings = { 'xl/worksheets/sheet1.xml': `<worksheet xmlns="${MAIN}"><sheetData/></worksheet>`, 'xl/sharedStrings.xml': `<sst>${'<si/>'.repeat(20_001)}</sst>` };
    expect(await readSheetFile(new Blob([zipStored(strings)]), MB)).toEqual({ ok: false, problem: 'tooBig' });
  });

  it('reads rows and strings one level deep only, and never a sheet whose strings could not be read as empty', async () => {
    const nested = `<worksheet xmlns="${MAIN}"><sheetData><row r="1"><c><v>1</v></c><row><c><v>9</v></c></row></row></sheetData></worksheet>`;
    expect(await readSheetFile(new Blob([zipStored({ 'xl/worksheets/sheet1.xml': nested })]), MB)).toEqual({ ok: true, rows: [['1']] });
    const broken = { 'xl/worksheets/sheet1.xml': `<worksheet xmlns="${MAIN}"><sheetData><row><c t="s"><v>0</v></c></row></sheetData></worksheet>`, 'xl/sharedStrings.xml': '<sst' };
    expect(await readSheetFile(new Blob([zipStored(broken)]), MB)).toEqual({ ok: false, problem: 'unreadable' });
  });

  it('reads a long shared string used by many cells once, and keeps no cell past a thousand characters', async () => {
    const strings = `<sst xmlns="${MAIN}"><si><t>${' '.repeat(500_000)}x</t></si><si><t>${'y'.repeat(5_000)}</t></si></sst>`;
    const rows = Array.from({ length: 2_000 }, () => '<row><c t="s"><v>0</v></c><c t="s"><v>1</v></c></row>').join('');
    const parts = { 'xl/worksheets/sheet1.xml': `<worksheet xmlns="${MAIN}"><sheetData>${rows}</sheetData></worksheet>`, 'xl/sharedStrings.xml': strings };
    const read = await readSheetFile(new Blob([zipStored(parts)]), 2 * MB);
    expect(read.ok && read.rows[0]).toEqual(['', 'y'.repeat(1_000)]);
  });

  it('stops inflating a part past the most bytes, whatever its header says', async () => {
    const huge = `<worksheet xmlns="${MAIN}"><sheetData>${'<row/>'.repeat(4_000_000)}</sheetData></worksheet>`;
    const bytes = await zipDeflated({ 'xl/worksheets/sheet1.xml': huge });
    // The central directory claims a small size, as a crafted file would.
    new DataView(bytes.buffer).setUint32(bytes.length - 22 - 46 - 'xl/worksheets/sheet1.xml'.length + 24, 100, true);
    expect(await readSheetFile(new Blob([bytes]), 10 * MB)).toEqual({ ok: false, problem: 'unreadable' });
  });
});
