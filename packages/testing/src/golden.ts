/** One worked example: what it shows in plain words, the operation, its inputs and the expected result, all as text. */
export interface GoldenCase {
  readonly description: string;
  readonly operation: string;
  readonly inputs: Readonly<Record<string, string>>;
  readonly expected: Readonly<Record<string, string>>;
}

/** A golden file from `packages/testing/golden/`: the rule it checks, a note for the reader, and its cases. */
export interface GoldenFile {
  readonly rule: string;
  readonly about: string;
  readonly cases: readonly GoldenCase[];
}

function malformed(problem: string): never {
  throw new Error(`Malformed golden file: ${problem}`);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isTextRecord(value: unknown): value is Readonly<Record<string, string>> {
  return isRecord(value) && Object.values(value).every((entry) => typeof entry === 'string');
}

function isText(value: unknown): value is string {
  return typeof value === 'string' && value.trim() !== '';
}

function readCase(value: unknown, index: number): GoldenCase {
  if (!isRecord(value)) return malformed(`case ${index} is not an object`);
  const { description, operation, inputs, expected } = value;
  if (!isText(description) || !isText(operation)) return malformed(`case ${index} needs a description and an operation`);
  if (!isTextRecord(inputs) || !isTextRecord(expected)) return malformed(`case ${index} needs inputs and expected values as text`);
  return { description, operation, inputs, expected };
}

/**
 * Checks the shape of an imported golden file and returns it typed:
 * `readGolden(moneyJson)` after `import moneyJson from '@rivr/testing/golden/money.json'`.
 * Throws on a malformed file, because a broken fixture is a bug.
 */
export function readGolden(json: unknown): GoldenFile {
  if (!isRecord(json)) return malformed('it is not an object');
  const { rule, about, cases } = json;
  if (!isText(rule) || !isText(about)) return malformed('it needs a rule and an about note');
  if (!Array.isArray(cases) || cases.length === 0) return malformed('it has no cases');
  return { rule, about, cases: cases.map(readCase) };
}

/** The cases of one operation as `[description, case]` pairs for `it.each`. Throws when there are none. */
export function casesFor(file: GoldenFile, operation: string): [string, GoldenCase][] {
  const cases = file.cases.filter((goldenCase) => goldenCase.operation === operation);
  if (cases.length === 0) throw new Error(`There is no golden case for "${operation}" in ${file.rule}`);
  return cases.map((goldenCase) => [goldenCase.description, goldenCase]);
}

/** Throws when a case uses an operation the test does not cover, so no case is skipped silently. */
export function assertOperations(file: GoldenFile, tested: readonly string[]): void {
  const untested = file.cases.find((goldenCase) => !tested.includes(goldenCase.operation));
  if (untested !== undefined) {
    throw new Error(`Golden case "${untested.description}": operation "${untested.operation}" is not tested`);
  }
}

/** A named input of a case. Throws when the fixture does not have it. */
export function goldenInput(goldenCase: GoldenCase, name: string): string {
  const value = goldenCase.inputs[name];
  if (value === undefined) throw new Error(`Golden case "${goldenCase.description}" has no input "${name}"`);
  return value;
}

/** A named expected value of a case. Throws when the fixture does not have it. */
export function goldenExpected(goldenCase: GoldenCase, name: string): string {
  const value = goldenCase.expected[name];
  if (value === undefined) throw new Error(`Golden case "${goldenCase.description}" has no expected "${name}"`);
  return value;
}
