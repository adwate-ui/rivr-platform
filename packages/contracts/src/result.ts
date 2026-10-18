/** A success carrying `value`. */
export interface Ok<T> {
  readonly ok: true;
  readonly value: T;
}

/** An expected failure carrying `error`, such as a declined payout or a mistyped amount. */
export interface Err<E> {
  readonly ok: false;
  readonly error: E;
}

/**
 * The outcome of an operation that can fail in a way the caller must handle. Expected failures
 * return `err`; only bugs throw. One shared type for domain, adapters and db (docs/decisions/0012).
 */
export type Result<T, E> = Ok<T> | Err<E>;

/** Wraps a successful value. */
export function ok<T>(value: T): Ok<T> {
  return { ok: true, value };
}

/** Wraps an expected failure. */
export function err<E>(error: E): Err<E> {
  return { ok: false, error };
}
