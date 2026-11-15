// A failure a screen handles itself is reported by a short code (decision 0604): a word the code, the database or
// Auth gave it, never anything a person typed. What is not such a word is `unknown`.

// A word: letters, digits and joiners, with a letter in it. The database's five-digit codes (42501) are the one other form.
const WORD = /^(?=.*[A-Za-z])[\w.-]{1,40}$/;
const SQLSTATE = /^\d{5}$/;

// Two digits at a time, so the scrubber's rule for numbers (four digits or more) leaves a database code readable: 42x501.
const withDigitsApart = (code: string): string => code.replace(/(\d{2})(?=\d{2})/g, '$1x');

const textAt = (value: object, key: string): string | null => {
  const found: unknown = Reflect.get(value, key);
  return typeof found === 'string' ? found : null;
};

/** The code a failure is reported by: its own if it is one, else its `code` (the database, Auth), else its error's name. */
export function failureCodeOf(failure: unknown): string {
  if (typeof failure === 'string') return WORD.test(failure) || SQLSTATE.test(failure) ? withDigitsApart(failure) : 'unknown';
  if (typeof failure !== 'object' || failure === null) return 'unknown';
  const code = textAt(failure, 'code') ?? textAt(failure, 'name');
  return code === null ? 'unknown' : failureCodeOf(code);
}

/** A read that failed, by what was read and why: `read:member:42x501`. The name is the query's, never the ids after it. */
export function readFailureCode(queryKey: readonly unknown[], error: unknown): string {
  const name = queryKey[0] === 'user' ? queryKey[2] : queryKey[0];
  return `read:${failureCodeOf(name)}:${failureCodeOf(error)}`;
}

/** A change the server refused, `{ ok: false }`, by its code: `refused:not_live`. Null for any other answer. */
export function refusalCodeOf(answer: unknown): string | null {
  if (typeof answer !== 'object' || answer === null || Reflect.get(answer, 'ok') !== false) return null;
  return `refused:${failureCodeOf(Reflect.get(answer, 'error'))}`;
}
