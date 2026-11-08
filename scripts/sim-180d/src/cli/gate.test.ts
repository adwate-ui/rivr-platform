import { describe, expect, it } from 'vitest';
import { gateLines, isNotCode, type GateFacts } from './gate.ts';

const READY: GateFacts = {
  harnessDirty: [],
  harnessPushed: true,
  harnessOnMain: true,
  prs: [{ number: 843, title: 'feat(console): filters', state: 'MERGED' }],
  openPrs: [],
  worktrees: [
    { path: '/home/x2/rivr-quick', dirty: ['?? .quick-scratch/'] },
    { path: '/home/x2/rivr-bonus', dirty: ['?? docs/tasks/console-batch-plan.md'] },
    { path: '/home/x2/rivr-platform', dirty: ['?? apps/driver/'] },
  ],
};

const failing = (facts: GateFacts, mode: 'dry' | 'full') => gateLines(facts, mode).filter((line) => !line.ok).map((line) => line.check);

describe('isNotCode', () => {
  it('lets scratch folders, notes under docs/ and known leftovers through', () => {
    expect(isNotCode('?? .quick-scratch/')).toBe(true);
    expect(isNotCode('?? docs/tasks/plan.md')).toBe(true);
    expect(isNotCode('?? apps/driver/')).toBe(true);
  });

  it('counts tracked changes and untracked code as uncommitted', () => {
    expect(isNotCode(' M e2e/flows/floor-requests.spec.ts')).toBe(false);
    expect(isNotCode(' M docs/tasks/plan.md')).toBe(false);
    expect(isNotCode('?? apps/console/src/New.tsx')).toBe(false);
  });
});

describe('gateLines', () => {
  it('passes when everything is committed and merged', () => {
    expect(failing(READY, 'full')).toEqual([]);
  });

  it('stops on an unmerged batch PR, another open PR, or uncommitted code anywhere', () => {
    const facts: GateFacts = {
      ...READY,
      prs: [{ number: 843, title: 't', state: 'OPEN' }],
      openPrs: [{ number: 844, title: 'fix(floor): approve seats' }],
      worktrees: [{ path: '/home/x2/rivr-quick', dirty: [' M e2e/flows/floor-requests.spec.ts'] }],
    };
    expect(failing(facts, 'full')).toEqual(['#843 merged', 'no other PR open', '/home/x2/rivr-quick committed']);
  });

  it('stops on an uncommitted, unpushed or stale harness', () => {
    const facts: GateFacts = { ...READY, harnessDirty: [' M scripts/sim-180d/sql/03_floor.sql'], harnessPushed: false, harnessOnMain: false };
    expect(failing(facts, 'full')).toEqual(['harness committed', 'harness pushed', 'harness on main']);
  });

  it('asks a dry run only for a committed, pushed harness', () => {
    const facts: GateFacts = { ...READY, harnessOnMain: false, openPrs: [{ number: 844, title: 't' }] };
    expect(failing(facts, 'dry')).toEqual([]);
    expect(gateLines(facts, 'dry').map((line) => line.check)).toEqual(['harness committed', 'harness pushed']);
  });
});
