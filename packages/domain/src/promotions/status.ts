import type { PromotionStatus } from '@rivr/contracts/promotionModel';
import { err, ok, type Result } from '@rivr/contracts/result';
import { sameTerms, type Terms } from './terms.ts';

/** A version as the status machine reads it: its status, who submitted it, its terms and the terms its simulation ran on. */
export interface VersionState {
  readonly status: PromotionStatus;
  readonly authorId: string | null;
  readonly terms: Terms;
  readonly simulatedTerms: Terms | null;
}

/** The staff member acting, with their permissions at the venue. */
export interface Actor {
  readonly staffId: string;
  readonly permissions: readonly string[];
}

/** What can be done to a version. Approving and starting need the club day; rejecting needs a reason. */
export type PromotionAction =
  | { readonly kind: 'submit' | 'pause' | 'resume' | 'end' | 'edit' }
  | { readonly kind: 'approve' | 'start'; readonly today: string }
  | { readonly kind: 'reject'; readonly reason: string };

/** What an action does: the version's new status, and for an edit the new draft version it opens beside this one. */
export interface Transition {
  readonly status: PromotionStatus;
  /** An edit of a running version: a draft of the next version opens, and this one keeps running until that is approved. */
  readonly opensDraft: boolean;
  /** An approval: the version that ran before ends. */
  readonly endsPrevious: boolean;
  readonly rejectedReason: string | null;
}

/**
 * Why an action is refused: not from this status, a missing permission, no simulation on these terms, the author
 * approving, no reason for a rejection, or a start before the start day.
 */
export type TransitionError = 'not_from_this_status' | 'needs_permission' | 'needs_simulation' | 'own_promotion' | 'needs_reason' | 'before_start_day';

const MANAGE = 'promotions.manage';
const APPROVE = 'promotions.approve';
const RUNNING: readonly PromotionStatus[] = ['scheduled', 'live', 'paused'];

// From which statuses each action is taken, and the permission it needs; starting is the clock's.
const RULES: Readonly<Record<PromotionAction['kind'], { readonly from: readonly PromotionStatus[]; readonly permission: string | null }>> = {
  submit: { from: ['draft'], permission: MANAGE },
  approve: { from: ['awaiting_approval'], permission: APPROVE },
  reject: { from: ['awaiting_approval'], permission: APPROVE },
  start: { from: ['scheduled'], permission: null },
  pause: { from: ['live'], permission: MANAGE },
  resume: { from: ['paused'], permission: MANAGE },
  end: { from: RUNNING, permission: MANAGE },
  edit: { from: RUNNING, permission: MANAGE },
};

const to = (status: PromotionStatus, more: Partial<Transition> = {}): Transition => ({
  status, opensDraft: false, endsPrevious: false, rejectedReason: null, ...more,
});

/** What one action asks beyond its status and permission. */
function actionRefusal(state: VersionState, action: PromotionAction, actor: Actor): TransitionError | null {
  switch (action.kind) {
    case 'submit':
      return state.simulatedTerms !== null && sameTerms(state.simulatedTerms, state.terms) ? null : 'needs_simulation';
    case 'approve':
      return state.authorId === actor.staffId ? 'own_promotion' : null;
    case 'reject':
      return action.reason.trim().length >= 3 ? null : 'needs_reason';
    case 'start':
      return state.terms.schedule.startsOn <= action.today ? null : 'before_start_day';
    default:
      return null;
  }
}

function guardOf(state: VersionState, action: PromotionAction, actor: Actor): TransitionError | null {
  const rule = RULES[action.kind];
  if (!rule.from.includes(state.status)) return 'not_from_this_status';
  if (rule.permission !== null && !actor.permissions.includes(rule.permission)) return 'needs_permission';
  return actionRefusal(state, action, actor);
}

function outcomeOf(state: VersionState, action: PromotionAction): Transition {
  switch (action.kind) {
    case 'submit':
      return to('awaiting_approval');
    case 'approve':
      return to(state.terms.schedule.startsOn <= action.today ? 'live' : 'scheduled', { endsPrevious: true });
    case 'reject':
      return to('draft', { rejectedReason: action.reason.trim() });
    case 'pause':
      return to('paused');
    case 'end':
      return to('ended');
    case 'edit':
      return to(state.status, { opensDraft: true });
    default:
      return to('live');
  }
}

/**
 * The status machine of a promotion's version (decision 0471): draft → awaiting approval → scheduled → live ⇄ paused →
 * ended. Submitting needs a simulation run on these very terms. Approving needs promotions.approve and someone other
 * than the author (four eyes); it goes live at once when the start day has come, scheduled otherwise, and ends the
 * version that ran before. Rejecting sends it back to draft with a reason. Starting is the clock's, on the start day.
 * Editing a scheduled, live or paused version opens a draft of the next version and leaves this one running. The
 * database's functions refuse the same; this lets the console show only what may be done.
 */
export function transition(state: VersionState, action: PromotionAction, actor: Actor): Result<Transition, TransitionError> {
  const refusal = guardOf(state, action, actor);
  return refusal === null ? ok(outcomeOf(state, action)) : err(refusal);
}
