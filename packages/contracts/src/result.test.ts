import { describe, expect, it } from 'vitest';
import { err, ok, type Result } from './result.ts';

function halve(value: number): Result<number, 'odd'> {
  return value % 2 === 0 ? ok(value / 2) : err('odd');
}

describe('Result', () => {
  it('carries the value of a success', () => {
    expect(ok(42)).toEqual({ ok: true, value: 42 });
  });

  it('carries the error of an expected failure', () => {
    expect(err('odd')).toEqual({ ok: false, error: 'odd' });
  });

  it('narrows to the value or the error by checking ok', () => {
    const halved = halve(8);
    const failed = halve(7);

    expect(halved.ok && halved.value).toBe(4);
    expect(!failed.ok && failed.error).toBe('odd');
  });
});
