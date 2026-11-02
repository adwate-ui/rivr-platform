/**
 * How much of a called seat's hold is left, from 1 when the seat is called to 0 when the hold runs out (decision 0320): the
 * gold bar under the countdown. Times the server gave; a hold with no length is nothing left.
 */
export function holdFraction(calledAt: Date, holdUntil: Date, at: Date): number {
  const length = holdUntil.getTime() - calledAt.getTime();
  if (length <= 0) return 0;
  return Math.min(1, Math.max(0, (holdUntil.getTime() - at.getTime()) / length));
}
