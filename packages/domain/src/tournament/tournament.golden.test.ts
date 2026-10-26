import {
  assertOperations, casesFor, formatMinutesSeconds, formatStages, goldenExpected, goldenInput, parseMinutesSeconds, parseStages, readGolden,
  type GoldenCase,
} from '@rivr/testing';
import blindStructureJson from '@rivr/testing/golden/blindStructure.json';
import tournamentMoneyJson from '@rivr/testing/golden/tournamentMoney.json';
import tournamentSeatingJson from '@rivr/testing/golden/tournamentSeating.json';
import tournamentClockJson from '@rivr/testing/golden/tournamentClock.json';
import tournamentEntryJson from '@rivr/testing/golden/tournamentEntry.json';
import { describe, expect, it } from 'vitest';
import { fromPaise } from '../money/index.ts';
import { planStructure } from './calculator.ts';
import { clockAt } from './clock.ts';
import { checkPurchase, TOURNAMENT_FORMATS, type Purchase, type TournamentFormat } from './entry.ts';
import { poolShare } from './pool.ts';
import { balancingMoves, eligibleSeats, finishPlace } from './seating.ts';

const clockGolden = readGolden(tournamentClockJson);
const entryGolden = readGolden(tournamentEntryJson);
const structureGolden = readGolden(blindStructureJson);
const moneyGolden = readGolden(tournamentMoneyJson);
const seatingGolden = readGolden(tournamentSeatingJson);

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

/** A golden amount such as "₹10,000" or "-₹50", in paise. */
const paise = (text: string) => BigInt(text.replace(/[₹,]/g, '')) * 100n;
/** Paise as a golden amount: "₹9,000". */
const rupees = (amount: bigint) => `₹${new Intl.NumberFormat('en-IN').format(amount / 100n)}`;
/** "1/2 2/3" as seats. */
const seats = (text: string) => text.split(' ').filter(Boolean).map((place) => {
  const [table, seat] = place.split('/').map(Number);
  return { table: table ?? 0, seat: seat ?? 0 };
});

describe('Tournament money golden fixtures (packages/testing/golden/tournamentMoney.json)', () => {
  it('tests every operation in the file', () => {
    expect(() => assertOperations(moneyGolden, ['share'])).not.toThrow();
  });

  it.each(casesFor(moneyGolden, 'share'))('%s', (_description, goldenCase) => {
    const share = () => rupees(poolShare(fromPaise(paise(goldenInput(goldenCase, 'price'))), fromPaise(paise(goldenInput(goldenCase, 'fee')))));
    const expected = goldenExpected(goldenCase, 'pool');
    if (expected === 'refused') expect(share).toThrow(RangeError);
    else expect(share()).toBe(expected);
  });
});

describe('Tournament seating golden fixtures (packages/testing/golden/tournamentSeating.json)', () => {
  it('tests every operation in the file', () => {
    expect(() => assertOperations(seatingGolden, ['eligible', 'balance', 'place'])).not.toThrow();
  });

  it.each(casesFor(seatingGolden, 'eligible'))('%s', (_description, goldenCase) => {
    const found = eligibleSeats(seats(goldenInput(goldenCase, 'occupied')), whole(goldenCase, 'tables'), whole(goldenCase, 'seatsPerTable'));
    expect(found.map((place) => `${String(place.table)}/${String(place.seat)}`).join(' ')).toBe(goldenExpected(goldenCase, 'seats'));
  });

  it.each(casesFor(seatingGolden, 'balance'))('%s', (_description, goldenCase) => {
    const moves = balancingMoves(goldenInput(goldenCase, 'counts').split(' ').map(Number));
    expect(moves.map((move) => `${String(move.from)}>${String(move.to)}`).join(' ')).toBe(goldenExpected(goldenCase, 'moves'));
  });

  it.each(casesFor(seatingGolden, 'place'))('%s', (_description, goldenCase) => {
    const place = () => String(finishPlace(whole(goldenCase, 'runs'), whole(goldenCase, 'bustRank')));
    const expected = goldenExpected(goldenCase, 'place');
    if (expected === 'refused') expect(place).toThrow(RangeError);
    else expect(place()).toBe(expected);
  });
});
