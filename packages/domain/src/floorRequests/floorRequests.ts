/** What waits on the Live floor (decision 0479): a join, a top-up, more time, a player leaving, one who left owing call time. */
export type FloorRequestKind = 'join' | 'top_up' | 'time' | 'leaving' | 'left_owing';

/** How long, in seconds, a request may wait before it shows late: a top-up, and every other request. */
export interface RequestTargets {
  readonly topUpSeconds: number;
  readonly otherSeconds: number;
}

/** Every request but a top-up: five minutes (console v3 brief). */
export const REQUEST_TARGET_SECONDS = 300;

/** A top-up on the Live floor: three minutes (the owner's console v3 brief, 3 Nov, over the 2 Nov sixty seconds). */
export const TOP_UP_REQUEST_TARGET_SECONDS = 180;

/** The targets with none set by the club (setting floor.request_targets): three minutes for a top-up, five for the rest. */
export const DEFAULT_REQUEST_TARGETS: RequestTargets = { topUpSeconds: TOP_UP_REQUEST_TARGET_SECONDS, otherSeconds: REQUEST_TARGET_SECONDS };

/** The club's targets where it set them, else the defaults; each side on its own. */
export function requestTargets(set: { readonly topUpSeconds: number | null; readonly otherSeconds: number | null } | undefined): RequestTargets {
  return {
    topUpSeconds: set?.topUpSeconds ?? DEFAULT_REQUEST_TARGETS.topUpSeconds,
    otherSeconds: set?.otherSeconds ?? DEFAULT_REQUEST_TARGETS.otherSeconds,
  };
}

/** Whether a request has waited past its target: a top-up past the top-up target, anything else past the other. */
export function isRequestLate(kind: FloorRequestKind, waitedSeconds: number, targets: RequestTargets): boolean {
  return waitedSeconds > (kind === 'top_up' ? targets.topUpSeconds : targets.otherSeconds);
}
