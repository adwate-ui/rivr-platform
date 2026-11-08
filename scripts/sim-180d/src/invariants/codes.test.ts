import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CODES, codesIn } from './codes.ts';

const sqlOf = (name: string): string => readFileSync(new URL(`../../sql/${name}`, import.meta.url), 'utf8');
const inSql = [...codesIn(sqlOf('12_checks.sql')), ...codesIn(sqlOf('13_checks_people.sql'))];

describe('CODES', () => {
  it('names every check the SQL runs, each once', () => {
    expect(new Set(inSql).size).toBe(inSql.length);
    expect(inSql.filter((code) => !(code in CODES))).toEqual([]);
  });

  it('names no check the SQL does not run', () => {
    expect(Object.keys(CODES).filter((code) => !inSql.includes(code))).toEqual([]);
  });
});

describe('codesIn', () => {
  it('reads the codes of sim.check calls only', () => {
    expect(codesIn("perform sim.check(d, p_scope, 'L01', 't', 'q'); -- 'Z99'")).toEqual(['L01']);
  });
});
