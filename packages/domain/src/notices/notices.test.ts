import { describe, expect, it } from 'vitest';
import { homeTopSlot } from './index.ts';

const kitchen = { id: 'kitchen', startsAt: new Date('2026-11-15T12:00:00Z') };
const valet = { id: 'valet', startsAt: new Date('2026-11-15T14:30:00Z') };
const table4 = { id: 'table4', startsAt: new Date('2026-11-15T13:00:00Z') };

describe('Home\'s top slot (redesign RD-20)', () => {
  it('shows the ID check while it is not done, whatever notices are in force', () => {
    expect(homeTopSlot({ seat: 'none', isIdCheckDone: false, notices: [] })).toEqual({ kind: 'idCheck' });
    expect(homeTopSlot({ seat: 'none', isIdCheckDone: false, notices: [kitchen, valet] })).toEqual({ kind: 'idCheck' });
  });

  it('shows the notice that started last once the ID check is done, in whatever order they are listed', () => {
    expect(homeTopSlot({ seat: 'none', isIdCheckDone: true, notices: [kitchen] })).toEqual({ kind: 'notice', notice: kitchen });
    expect(homeTopSlot({ seat: 'none', isIdCheckDone: true, notices: [kitchen, valet, table4] })).toEqual({ kind: 'notice', notice: valet });
    expect(homeTopSlot({ seat: 'none', isIdCheckDone: true, notices: [valet, table4, kitchen] })).toEqual({ kind: 'notice', notice: valet });
  });

  it('shows the one listed first of two that started together', () => {
    const twin = { id: 'twin', startsAt: valet.startsAt };
    expect(homeTopSlot({ seat: 'none', isIdCheckDone: true, notices: [valet, twin] })).toEqual({ kind: 'notice', notice: valet });
    expect(homeTopSlot({ seat: 'none', isIdCheckDone: true, notices: [twin, valet] })).toEqual({ kind: 'notice', notice: twin });
  });

  it('shows nothing with the ID check done and no notice in force', () => {
    expect(homeTopSlot({ seat: 'none', isIdCheckDone: true, notices: [] })).toBeNull();
  });

  it('shows neither while a seat is called or taken', () => {
    for (const seat of ['called', 'taken'] as const) {
      expect(homeTopSlot({ seat, isIdCheckDone: false, notices: [kitchen] })).toBeNull();
      expect(homeTopSlot({ seat, isIdCheckDone: true, notices: [kitchen, valet] })).toBeNull();
    }
  });
});
