import { buildPromotionTerms } from '@rivr/testing';
import { describe, expect, it } from 'vitest';
import { transition, type Actor, type PromotionAction, type VersionState } from './status.ts';

const terms = buildPromotionTerms({ schedule: { days: [5, 6], from: '20:00', to: '02:00', startsOn: '2026-11-20', timezone: 'Asia/Kolkata' } });
const MANAGER: Actor = { staffId: 'meera', permissions: ['promotions.manage'] };
const OWNER: Actor = { staffId: 'vikram', permissions: ['promotions.manage', 'promotions.approve'] };
const state = (more: Partial<VersionState> = {}): VersionState => ({ status: 'draft', authorId: null, terms, simulatedTerms: terms, ...more });
const take = (from: Partial<VersionState>, action: PromotionAction, actor: Actor = OWNER) => transition(state(from), action, actor);
const statusOf = (result: ReturnType<typeof transition>) => (result.ok ? result.value.status : result.error);

describe('transition', () => {
  it('submits a draft simulated on its very terms', () => {
    expect(statusOf(take({}, { kind: 'submit' }, MANAGER))).toBe('awaiting_approval');
  });

  it('refuses to submit a draft not simulated, or simulated before an edit', () => {
    expect(take({ simulatedTerms: null }, { kind: 'submit' }, MANAGER)).toEqual({ ok: false, error: 'needs_simulation' });
    const edited = buildPromotionTerms({ reward: { kind: 'points_multiplier', multiplier: 3 } });
    expect(take({ terms: edited }, { kind: 'submit' }, MANAGER)).toEqual({ ok: false, error: 'needs_simulation' });
  });

  it('approves with promotions.approve, never by its author', () => {
    const waiting = { status: 'awaiting_approval' as const, authorId: 'meera' };
    expect(take(waiting, { kind: 'approve', today: '2026-11-20' }, MANAGER)).toEqual({ ok: false, error: 'needs_permission' });
    expect(take({ ...waiting, authorId: 'vikram' }, { kind: 'approve', today: '2026-11-20' })).toEqual({ ok: false, error: 'own_promotion' });
    expect(take(waiting, { kind: 'approve', today: '2026-11-20' })).toEqual({
      ok: true, value: { status: 'live', opensDraft: false, endsPrevious: true, rejectedReason: null },
    });
  });

  it('schedules an approval before the start day, and starts it on the day', () => {
    expect(statusOf(take({ status: 'awaiting_approval', authorId: 'meera' }, { kind: 'approve', today: '2026-11-19' }))).toBe('scheduled');
    expect(take({ status: 'scheduled' }, { kind: 'start', today: '2026-11-19' }, MANAGER)).toEqual({ ok: false, error: 'before_start_day' });
    expect(statusOf(take({ status: 'scheduled' }, { kind: 'start', today: '2026-11-20' }, MANAGER))).toBe('live');
  });

  it('rejects back to draft with a reason of at least three letters', () => {
    expect(take({ status: 'awaiting_approval', authorId: 'meera' }, { kind: 'reject', reason: ' no ' })).toEqual({ ok: false, error: 'needs_reason' });
    expect(take({ status: 'awaiting_approval', authorId: 'meera' }, { kind: 'reject', reason: ' Too generous ' })).toEqual({
      ok: true, value: { status: 'draft', opensDraft: false, endsPrevious: false, rejectedReason: 'Too generous' },
    });
    expect(take({ status: 'awaiting_approval' }, { kind: 'reject', reason: 'Too generous' }, MANAGER)).toEqual({ ok: false, error: 'needs_permission' });
    expect(statusOf(take({ status: 'awaiting_approval', authorId: 'meera' }, { kind: 'reject', reason: 'Why' }))).toBe('draft');
  });

  it('pauses a live one, resumes a paused one and ends either', () => {
    expect(statusOf(take({ status: 'live' }, { kind: 'pause' }, MANAGER))).toBe('paused');
    expect(statusOf(take({ status: 'paused' }, { kind: 'resume' }, MANAGER))).toBe('live');
    expect(statusOf(take({ status: 'paused' }, { kind: 'end' }, MANAGER))).toBe('ended');
    expect(statusOf(take({ status: 'scheduled' }, { kind: 'end' }, MANAGER))).toBe('ended');
    expect(take({ status: 'live' }, { kind: 'pause' }, { staffId: 'arun', permissions: [] })).toEqual({ ok: false, error: 'needs_permission' });
  });

  it('opens a new draft when a running version is edited, and keeps it running', () => {
    expect(take({ status: 'live' }, { kind: 'edit' }, MANAGER)).toEqual({ ok: true, value: { status: 'live', opensDraft: true, endsPrevious: false, rejectedReason: null } });
    expect(take({ status: 'draft' }, { kind: 'edit' }, MANAGER)).toEqual({ ok: false, error: 'not_from_this_status' });
  });

  it('takes nothing out of turn', () => {
    expect(take({ status: 'ended' }, { kind: 'resume' }, MANAGER)).toEqual({ ok: false, error: 'not_from_this_status' });
    expect(take({ status: 'live' }, { kind: 'approve', today: '2026-11-20' })).toEqual({ ok: false, error: 'not_from_this_status' });
    expect(take({ status: 'awaiting_approval' }, { kind: 'submit' }, MANAGER)).toEqual({ ok: false, error: 'not_from_this_status' });
    expect(take({ status: 'live' }, { kind: 'resume' }, MANAGER)).toEqual({ ok: false, error: 'not_from_this_status' });
  });
});
