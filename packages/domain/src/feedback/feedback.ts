/** How long an open ticket may wait before it shows as past its target: two days (decision 0552). */
export const FEEDBACK_AGE_TARGET_SECONDS = 48 * 60 * 60;

/** Whether an open ticket, this many seconds old, is past its target. */
export function isFeedbackOverdue(ageSeconds: number): boolean {
  return ageSeconds > FEEDBACK_AGE_TARGET_SECONDS;
}
