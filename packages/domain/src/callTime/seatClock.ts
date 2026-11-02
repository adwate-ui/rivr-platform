/** The call time's last stretch, when the seat's ring turns red and Tonight says it ends soon: 15 minutes (decision 0320). */
export const CALL_TIME_ENDING_SECONDS = 15 * 60;

/** Whether the call time is in its last 15 minutes and still running: the ring turns red, the banner and the push come. */
export function isCallTimeEnding(secondsLeft: number): boolean {
  return secondsLeft > 0 && secondsLeft <= CALL_TIME_ENDING_SECONDS;
}

/** The whole minutes the banner says are left, rounded up: 14 min 1 s left is "15 min". */
export function minutesLeftToSay(secondsLeft: number): number {
  return Math.ceil(Math.max(0, secondsLeft) / 60);
}

/** How much of the call time is left, from 1 at seating to 0 when done: the ring's arc. No call time is nothing left. */
export function callTimeFraction(secondsLeft: number, minutes: number): number {
  if (minutes <= 0) return 0;
  return Math.min(1, Math.max(0, secondsLeft / (minutes * 60)));
}

/** Whole seconds from `at` until `endsAt`, never below nought: a countdown to a time the server gave. */
export function secondsUntil(endsAt: Date, at: Date): number {
  return Math.max(0, Math.ceil((endsAt.getTime() - at.getTime()) / 1000));
}
