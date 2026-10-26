import {
  assertOperations, casesFor, formatMinutesSeconds, formatStages, goldenExpected, goldenInput, parseMinutesSeconds, parseStages, readGolden,
  type GoldenCase,
} from '@rivr/testing';
import blindStructureJson from '@rivr/testing/golden/blindStructure.json';
import tournamentClockJson from '@rivr/testing/golden/tournamentClock.json';
import tournamentEntryJson from '@rivr/testing/golden/tournamentEntry.json';
import { describe, expect, it } from 'vitest';
import { planStructure } from './calculator.ts';
import { clockAt } from './clock.ts';
import { checkPurchase, TOURNAMENT_FORMATS, type Purchase, type TournamentFormat } from './entry.ts';

const clockGolden = readGolden(tournamentClockJson);
const entryGolden = readGolden(tournamentEntryJson);
const structureGolden = readGolden(blindStructureJson);

const whole = (goldenCase: GoldenCase, name: string) => Number(goldenInput(goldenCase, name));
const yes = (goldenCase: GoldenCase, name: string) => goldenInput(goldenCase, name) === 'yes';
const PURCHASES: readonly Purchase[] = ['entry', 're_entry', 'rebuy', 'add_on'];

function format(goldenCase: GoldenCase): TournamentFormat {
  const found = TOURNAMENT_FORMATS.find((each) => each === goldenInput(goldenCase, 'format'));
  if (found === undefined) throw new Error('A golden format is a tournament format');
  return found;
}

function purchase(goldenCase: GoldenCase): Purchase {
  const found = PURCHASES.find((each) => each === goldenInput(goldenCase, 'purchase'));
  if (found === undefined) throw new Error('A golden purchase is a purchase');
  return found;
}

describe('Tournament clock golden fixtures (packages/testing/golden/tournamentClock.json)', () => {
  it('tests every operation in the file', () => {
    expect(() => assertOperations(clockGolden, ['position'])).not.toThrow();
  });

  it.each(casesFor(clockGolden, 'position'))('%s', (_description, goldenCase) => {
    const position = clockAt(parseStages(goldenInput(goldenCase, 'levels')), parseMinutesSeconds(goldenInput(goldenCase, 'elapsed')));
    expect({
      stage: String(position.stage), level: String(position.level), break: position.isBreak ? 'yes' : 'no', left: formatMinutesSeconds(position.secondsLeft),
    }).toEqual({
      stage: goldenExpected(goldenCase, 'stage'), level: goldenExpected(goldenCase, 'level'),
      break: goldenExpected(goldenCase, 'break'), left: goldenExpected(goldenCase, 'left'),
    });
  });
});

describe('Tournament entry golden fixtures (packages/testing/golden/tournamentEntry.json)', () => {
  it('tests every operation in the file', () => {
    expect(() => assertOperations(entryGolden, ['purchase'])).not.toThrow();
  });

  it.each(casesFor(entryGolden, 'purchase'))('%s', (_description, goldenCase) => {
    const maxBuys = goldenInput(goldenCase, 'maxBuys');
    const rules = { format: format(goldenCase), lastRegistrationLevel: whole(goldenCase, 'lastRegistrationLevel'),
      maxBuys: maxBuys === '' ? null : Number(maxBuys), hasAddOn: yes(goldenCase, 'addOn') };
    const player = { buys: whole(goldenCase, 'buys'), isAlive: yes(goldenCase, 'alive'), hasTakenAddOn: yes(goldenCase, 'addOnTaken') };
    const result = checkPurchase(purchase(goldenCase), rules, whole(goldenCase, 'level'), player);
    expect(result.ok ? 'allowed' : result.error).toBe(goldenExpected(goldenCase, 'result'));
  });
});

describe('Blind-structure calculator golden fixtures (packages/testing/golden/blindStructure.json)', () => {
  it('tests every operation in the file', () => {
    expect(() => assertOperations(structureGolden, ['plan'])).not.toThrow();
  });

  it.each(casesFor(structureGolden, 'plan'))('%s', (_description, goldenCase) => {
    const stages = planStructure({
      startingStack: whole(goldenCase, 'startingStack'), expectedEntries: whole(goldenCase, 'expectedEntries'),
      firstBigBlind: whole(goldenCase, 'firstBigBlind'), levelMinutes: whole(goldenCase, 'levelMinutes'),
      targetMinutes: whole(goldenCase, 'targetMinutes'), breakEvery: whole(goldenCase, 'breakEvery'),
      breakMinutes: whole(goldenCase, 'breakMinutes'), hasAnte: yes(goldenCase, 'ante'),
    });
    expect(formatStages(stages)).toBe(goldenExpected(goldenCase, 'levels'));
  });
});
