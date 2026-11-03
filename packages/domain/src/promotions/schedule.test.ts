import type { Schedule } from '@rivr/contracts/promotionModel';
import { describe, expect, it } from 'vitest';
import { isInSchedule, openingMinutes, secondsInSchedule } from './schedule.ts';

const WEEKEND_NIGHTS: Schedule = { days: [5, 6], from: '20:00', to: '02:00', startsOn: '2026-11-01', timezone: 'Asia/Kolkata' };
const at = (text: string) => new Date(text);

describe('openingMinutes', () => {
  it('runs from the start to the next end, across midnight when the end is earlier', () => {
    expect(openingMinutes({ from: '14:00', to: '20:00' })).toBe(360);
    expect(openingMinutes({ from: '20:00', to: '02:00' })).toBe(360);
    expect(openingMinutes({ from: '20:00', to: '20:01' })).toBe(1);
    expect(openingMinutes({ from: '20:01', to: '20:00' })).toBe(1_439);
  });

  it('takes the same time at both ends as a whole day', () => {
    expect(openingMinutes({ from: '06:00', to: '06:00' })).toBe(1_440);
    expect(openingMinutes({ from: '00:00', to: '00:00' })).toBe(1_440);
  });
});

describe('isInSchedule', () => {
  it('opens on the minute and closes before the end minute', () => {
    expect(isInSchedule(WEEKEND_NIGHTS, at('2026-11-20T20:00:00+05:30'))).toBe(true);
    expect(isInSchedule(WEEKEND_NIGHTS, at('2026-11-21T01:59:59.999+05:30'))).toBe(true);
    expect(isInSchedule(WEEKEND_NIGHTS, at('2026-11-21T02:00:00+05:30'))).toBe(false);
  });

  it('holds a Saturday opening into Sunday morning, but no Sunday opening', () => {
    expect(isInSchedule(WEEKEND_NIGHTS, at('2026-11-22T00:30:00+05:30'))).toBe(true);
    expect(isInSchedule(WEEKEND_NIGHTS, at('2026-11-22T20:30:00+05:30'))).toBe(false);
  });

  it('runs on the end day itself, and not after it', () => {
    const endsFriday = { ...WEEKEND_NIGHTS, endsOn: '2026-11-20' };
    expect(isInSchedule(endsFriday, at('2026-11-20T21:00:00+05:30'))).toBe(true);
    expect(isInSchedule(endsFriday, at('2026-11-21T21:00:00+05:30'))).toBe(false);
  });

  it('runs on the start day itself', () => {
    expect(isInSchedule({ ...WEEKEND_NIGHTS, startsOn: '2026-11-20' }, at('2026-11-20T21:00:00+05:30'))).toBe(true);
    expect(isInSchedule({ ...WEEKEND_NIGHTS, startsOn: '2026-11-21' }, at('2026-11-20T21:00:00+05:30'))).toBe(false);
  });

  it('runs a 24-hour opening from its start to the same time the next day', () => {
    const fromNoon: Schedule = { days: [2], from: '12:00', to: '12:00', startsOn: '2026-11-01', timezone: 'Asia/Kolkata' };
    expect(isInSchedule(fromNoon, at('2026-11-17T11:59:00+05:30'))).toBe(false);
    expect(isInSchedule(fromNoon, at('2026-11-17T12:00:00+05:30'))).toBe(true);
    expect(isInSchedule(fromNoon, at('2026-11-18T11:59:00+05:30'))).toBe(true);
    expect(isInSchedule(fromNoon, at('2026-11-18T12:00:00+05:30'))).toBe(false);
  });
});

describe('secondsInSchedule', () => {
  it('counts nothing for a span that ends before it starts', () => {
    expect(secondsInSchedule({ from: at('2026-11-21T01:00:00+05:30'), to: at('2026-11-20T21:00:00+05:30') }, WEEKEND_NIGHTS)).toBe(0);
  });

  it('counts the part of a span inside an opening, to the second', () => {
    expect(secondsInSchedule({ from: at('2026-11-20T19:59:30+05:30'), to: at('2026-11-20T20:00:45+05:30') }, WEEKEND_NIGHTS)).toBe(45);
    expect(secondsInSchedule({ from: at('2026-11-21T01:59:00+05:30'), to: at('2026-11-21T02:30:00+05:30') }, WEEKEND_NIGHTS)).toBe(60);
  });

  it('counts an opening that runs past the club turnover into the next club day', () => {
    const lateTuesday: Schedule = { days: [2], from: '22:00', to: '08:00', startsOn: '2026-11-01', timezone: 'Asia/Kolkata' };
    expect(secondsInSchedule({ from: at('2026-11-18T05:00:00+05:30'), to: at('2026-11-18T09:00:00+05:30') }, lateTuesday)).toBe(3 * 3_600);
  });
});
