import { describe, expect, it } from 'vitest';
import { placeOf } from './ColumnMenu.tsx';

/** A trigger at `left` to `right`, its foot at 100 px. */
const trigger = (left: number, right: number) => ({ getBoundingClientRect: () => DOMRect.fromRect({ x: left, y: 68, width: right - left, height: 32 }) });

describe('placeOf', () => {
  it('lines the menu up with its trigger\'s start, under it', () => {
    expect(placeOf(trigger(300, 332), 1440)).toEqual({ top: 104, left: 300 });
  });

  it('lines it up with the trigger\'s end where it would run off the page', () => {
    expect(placeOf(trigger(1300, 1332), 1440)).toEqual({ top: 104, left: 1332 - 288 });
  });

  it('keeps it on a phone\'s page, never past its left edge', () => {
    expect(placeOf(trigger(110, 150), 390)).toEqual({ top: 104, left: 0 });
    expect(placeOf(trigger(10, 40), 280)).toEqual({ top: 104, left: 0 });
  });
});
