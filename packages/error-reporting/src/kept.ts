/** The name the error of a failure a screen handled itself carries, by which it is told from a crash (decision 0604). */
export const HANDLED = 'HandledFailure';

/** One error waiting to be sent: what it was, whether the app caught it itself, and the route's pattern when it happened. */
export interface Kept {
  readonly error: unknown;
  readonly isCaught: boolean;
  readonly route: string;
}
