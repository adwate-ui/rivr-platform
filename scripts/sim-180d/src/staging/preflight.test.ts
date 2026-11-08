import { describe, expect, it } from 'vitest';
import { allowlistCheck, digestOf, numbersNamed, testNumbers } from './preflight.ts';

describe('testNumbers', () => {
  it('reads the numbers and counts those with the expected code', () => {
    expect(testNumbers('919000000101=111111, 919000000103=111111,919000000104=222222,bad', '111111')).toEqual({
      numbers: ['919000000101', '919000000103', '919000000104'],
      withCode: 2,
    });
  });

  it('is empty for no list', () => {
    expect(testNumbers('', '111111')).toEqual({ numbers: [], withCode: 0 });
  });
});

describe('numbersNamed', () => {
  it('finds each test number a flow names, once', () => {
    expect(numbersNamed("signInToConsole(page, '9000000117'); signIn('9000000117'); '9000000401'")).toEqual(['919000000117', '919000000401']);
  });
});

describe('allowlistCheck', () => {
  const owner = '+919999999999';

  it('passes when the list is the owner’s number alone', () => {
    expect(allowlistCheck([{ name: 'WHATSAPP_ALLOWLIST', value: digestOf(owner) }], owner).ok).toBe(true);
  });

  it('fails when the list is missing or holds anything else', () => {
    expect(allowlistCheck([], owner).ok).toBe(false);
    expect(allowlistCheck([{ name: 'WHATSAPP_ALLOWLIST', value: digestOf(`${owner},+919000000101`) }], owner).ok).toBe(false);
  });
});
