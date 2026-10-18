/**
 * A render job travels from Node to the host page in the URL. JSON has no bigint, and every
 * amount in RIVR is bigint paise, so bigints are written as `{"$bigint":"34260000"}`.
 */

/** What the host page needs to draw one template. */
export interface RenderJob {
  template: string;
  props: object;
}

/** The job as the `job` query parameter of the host page. */
export function encodeJob(job: RenderJob): string {
  return JSON.stringify(job, (_key, value: unknown) => (typeof value === 'bigint' ? { $bigint: value.toString() } : value));
}

/** Reads a job written by `encodeJob`, turning `{"$bigint": ...}` back into bigints. */
export function decodeJobJson(text: string): unknown {
  return JSON.parse(text, (_key, value: unknown) => {
    const digits = typeof value === 'object' && value !== null ? Reflect.get(value, '$bigint') : undefined;
    return typeof digits === 'string' ? BigInt(digits) : value;
  });
}
