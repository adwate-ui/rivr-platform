import { promotionConditionsSchema } from '@rivr/contracts/promotions';
import { assertOperations, casesFor, goldenExpected, goldenInput, readGolden } from '@rivr/testing';
import windowJson from '@rivr/testing/golden/promotionWindow.json';
import { describe, expect, it } from 'vitest';
import { playedSecondsInWindow, secondsInWindow, type Stint } from './window.ts';

const golden = readGolden(windowJson);

const conditions = (text: string) => promotionConditionsSchema.parse(JSON.parse(text));

/** Reads "from/to", as the fixture writes a stint. */
function stint(text: string): Stint {
  const [from = '', to = ''] = text.split('/');
  return { from: new Date(from), to: new Date(to) };
}

describe('Promotion window golden fixtures (packages/testing/golden/promotionWindow.json)', () => {
  it('tests every operation in the file', () => {
    expect(() => assertOperations(golden, ['window', 'played'])).not.toThrow();
  });

  it.each(casesFor(golden, 'window'))('%s', (_description, goldenCase) => {
    const seconds = secondsInWindow(
      stint(`${goldenInput(goldenCase, 'from')}/${goldenInput(goldenCase, 'to')}`),
      conditions(goldenInput(goldenCase, 'conditions')),
    );
    expect(seconds).toBe(BigInt(goldenExpected(goldenCase, 'seconds')));
  });

  it.each(casesFor(golden, 'played'))('%s', (_description, goldenCase) => {
    const time = {
      stints: goldenInput(goldenCase, 'stints').split(' | ').map(stint),
      sessionSeconds: BigInt(goldenInput(goldenCase, 'session')),
      playedSeconds: BigInt(goldenInput(goldenCase, 'played')),
    };
    expect(playedSecondsInWindow(time, conditions(goldenInput(goldenCase, 'conditions')))).toBe(BigInt(goldenExpected(goldenCase, 'seconds')));
  });
});
