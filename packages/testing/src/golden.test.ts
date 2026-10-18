import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { assertOperations, casesFor, goldenExpected, goldenInput, readGolden } from './golden.ts';

const GOLDEN_DIRECTORY = new URL('../golden/', import.meta.url);

const valid = {
  rule: 'example',
  about: 'Two cases.',
  cases: [
    { description: 'Doubles 2', operation: 'double', inputs: { value: '2' }, expected: { result: '4' } },
    { description: 'Halves 4', operation: 'halve', inputs: { value: '4' }, expected: { result: '2' } },
  ],
};

describe('readGolden', () => {
  it('returns a well-formed golden file unchanged', () => {
    expect(readGolden(valid)).toEqual(valid);
  });

  it.each([
    ['not an object', 'money'],
    ['no rule', { ...valid, rule: undefined }],
    ['no note for the reader', { ...valid, about: 3 }],
    ['no cases', { ...valid, cases: [] }],
    ['a case without a description', { ...valid, cases: [{ ...valid.cases[0], description: '' }] }],
    ['a case with a numeric input', { ...valid, cases: [{ ...valid.cases[0], inputs: { value: 2 } }] }],
    ['a case with expected values in a list', { ...valid, cases: [{ ...valid.cases[0], expected: ['4'] }] }],
    ['a case that is null', { ...valid, cases: [null] }],
  ])('throws on a file with %s, so a broken fixture fails loudly', (_problem, json) => {
    expect(() => readGolden(json)).toThrow(/golden file/);
  });

  it.each(readdirSync(GOLDEN_DIRECTORY).filter((name) => name.endsWith('.json')))(
    'reads %s from the golden directory',
    (name) => {
      const json: unknown = JSON.parse(readFileSync(new URL(name, GOLDEN_DIRECTORY), 'utf8'));
      expect(readGolden(json).cases.length).toBeGreaterThan(0);
    },
  );
});

describe('golden helpers', () => {
  const file = readGolden(valid);

  it('lists the cases of one operation as [description, case] pairs for it.each', () => {
    expect(casesFor(file, 'halve')).toEqual([['Halves 4', file.cases[1]]]);
  });

  it('throws when no case has the operation, so a typo cannot skip every case', () => {
    expect(() => casesFor(file, 'triple')).toThrow(/no golden case for "triple"/);
  });

  it('throws when a case uses an operation the test does not know', () => {
    expect(() => assertOperations(file, ['double', 'halve'])).not.toThrow();
    expect(() => assertOperations(file, ['double'])).toThrow(/"halve" is not tested/);
  });

  it('reads named inputs and expected values, and throws on a missing name', () => {
    const [, doubles] = casesFor(file, 'double')[0] ?? [];
    if (doubles === undefined) throw new Error('fixture missing');

    expect(goldenInput(doubles, 'value')).toBe('2');
    expect(goldenExpected(doubles, 'result')).toBe('4');
    expect(() => goldenInput(doubles, 'amount')).toThrow(/"Doubles 2" has no input "amount"/);
    expect(() => goldenExpected(doubles, 'total')).toThrow(/"Doubles 2" has no expected "total"/);
  });
});
