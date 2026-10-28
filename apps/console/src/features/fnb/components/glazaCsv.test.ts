import { fromRupees } from '@rivr/domain/money';
import { describe, expect, it } from 'vitest';
import { csvFields, readGlazaCsv } from './glazaCsv.ts';

const HEADING = 'time,table,seat,item,kind,quantity,unit_cost,unit_price,comp';

describe('csvFields', () => {
  it('splits on commas, keeps a quoted comma, and reads "" as a quote', () => {
    expect(csvFields('a, "b, c" ,"say ""hi"""')).toEqual(['a', 'b, c', 'say "hi"']);
  });
});

describe('readGlazaCsv', () => {
  it('reads each line as IST, with an empty seat as none, rupees as paise and comp as yes or no', () => {
    const file = readGlazaCsv(`\uFEFF${HEADING}\r\n2026-11-14 21:30,Table 3,5,Masala chai,soft_drink,2,20,60,yes\r\n\r\n2026-11-14 22:00,Table 3,,"Beer, pint",alcohol,3,150.50,400,No\r\n`);
    expect(file).toEqual({ ok: true, lines: [
      { soldAt: '2026-11-14T21:30:00+05:30', tableName: 'Table 3', seat: 5, item: 'Masala chai', kind: 'soft_drink', quantity: 2,
        unitCost: fromRupees(20n), unitPrice: fromRupees(60n), isComp: true },
      { soldAt: '2026-11-14T22:00:00+05:30', tableName: 'Table 3', seat: null, item: 'Beer, pint', kind: 'alcohol', quantity: 3,
        unitCost: fromRupees(150n) + 50n, unitPrice: fromRupees(400n), isComp: false },
    ] });
  });

  it('names the lines that do not read, by their line in the file', () => {
    const file = readGlazaCsv([HEADING, '2026-11-14 21:30,Table 3,,Chai,tea,1,20,60,yes', '2026-11-14 21:30,Table 3,,Chai,food,0,20,60,yes',
      '14/11/2026 21:30,Table 3,,Chai,food,1,20,60,yes', '2026-11-14 21:30,,,Chai,food,1,20,60,maybe', '2026-11-14 21:30,Table 3,,Chai,food,1,20,60,no'].join('\n'));
    expect(file).toEqual({ ok: false, badLines: [2, 3, 4, 5] });
  });

  it('refuses a file whose first line is not Glaza\u2019s columns, and one with no lines', () => {
    expect(readGlazaCsv('time,table,item\n')).toEqual({ ok: false, badLines: [1] });
    expect(readGlazaCsv(`${HEADING}\n`)).toEqual({ ok: false, badLines: [] });
  });
});
