import { describe, expect, it } from 'vitest';
import { menuItemsToSave, readMenuCsv } from './menuCsv.ts';

describe('readMenuCsv', () => {
  it('reads each line under its heading, in any column order, leaving out a price', () => {
    const csv = readMenuCsv('\uFEFFPrice,Type,Name,On offer\n120,Food,Club sandwich,yes\n90,"Soft drinks","Lime soda, sweet",no\n\n,,,\n350,bar,Beer,\n');
    expect(csv.fileProblem).toBeNull();
    expect(csv.lines).toEqual([
      { line: 2, ok: true, item: { name: 'Club sandwich', kind: 'food', isAvailable: true } },
      { line: 3, ok: true, item: { name: 'Lime soda, sweet', kind: 'soft_drink', isAvailable: false } },
      { line: 6, ok: true, item: { name: 'Beer', kind: 'alcohol', isAvailable: null } },
    ]);
    expect(menuItemsToSave(csv)).toHaveLength(3);
  });

  it('takes the kinds as the console and the app name them, and no other word', () => {
    const csv = readMenuCsv('name,kind\nA,food\nB,soft_drink\nC,Soft drink\nD,alcohol\nE,Bar\nF,constructor\n');
    expect(csv.lines.map((line) => (line.ok ? line.item.kind : line.problem))).toEqual(['food', 'soft_drink', 'soft_drink', 'alcohol', 'alcohol', 'type']);
  });

  it('leaves on offer unsaid when the file has no such column, so an item the menu has stays as it is', () => {
    const csv = readMenuCsv('name,type,price\nBeer,bar,350\n');
    expect(csv.lines).toEqual([{ line: 2, ok: true, item: { name: 'Beer', kind: 'alcohol', isAvailable: null } }]);
  });

  it('says what is wrong with each line, and saves nothing while one is wrong', () => {
    const csv = readMenuCsv(`name,type,on offer\n,food,yes\nTea,dessert,yes\nCoffee,food,maybe\n${'x'.repeat(61)},food,\nBeer,bar,\nbeer,bar,\n`);
    expect(csv.lines).toEqual([
      { line: 2, ok: false, problem: 'name' },
      { line: 3, ok: false, problem: 'type' },
      { line: 4, ok: false, problem: 'onOffer' },
      { line: 5, ok: false, problem: 'name' },
      { line: 6, ok: true, item: { name: 'Beer', kind: 'alcohol', isAvailable: null } },
      { line: 7, ok: false, problem: 'twice', name: 'beer' },
    ]);
    expect(menuItemsToSave(csv)).toBeNull();
  });

  it('needs a heading line that names the name and type columns', () => {
    expect(readMenuCsv('Club sandwich,food\nBeer,bar\n').fileProblem).toBe('columns');
    expect(readMenuCsv('name,price\nBeer,350\n').fileProblem).toBe('columns');
  });

  it('refuses a file with no items, or more than 300', () => {
    expect(readMenuCsv('name,type\n\n').fileProblem).toBe('empty');
    expect(readMenuCsv('').fileProblem).toBe('empty');
    const long = ['name,type', ...Array.from({ length: 301 }, (_, index) => `Item ${String(index)},food`)].join('\n');
    expect(readMenuCsv(long).fileProblem).toBe('tooMany');
    expect(menuItemsToSave(readMenuCsv(long))).toBeNull();
  });
});
