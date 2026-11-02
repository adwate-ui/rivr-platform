/** How long the floor has to bring a top-up (owner, 2 Nov; decision 0299): sixty seconds from the member asking. */
export const TOP_UP_TARGET_SECONDS = 60;

/** Whole seconds a top-up has waited since it was asked for, never below nothing. */
export function secondsWaiting(requestedAt: Date, now: Date): number {
  return Math.max(0, Math.floor((now.getTime() - requestedAt.getTime()) / 1000));
}

/** Whether a top-up has waited past its target. */
export function isTopUpLate(seconds: number): boolean {
  return seconds > TOP_UP_TARGET_SECONDS;
}
