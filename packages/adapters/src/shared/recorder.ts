/** What every fake lets a test see and steer: the calls it received, and failures to return next. */
export interface FakeControls<Call, Failure> {
  /** Every call received, oldest first, including the ones made to fail. */
  readonly calls: readonly Call[];
  /** Makes the next call fail with `failure`; queue several to fail several calls in a row. */
  failNext(failure: Failure): void;
}

/** The bookkeeping a fake is built on. */
export interface Recorder<Call, Failure> extends FakeControls<Call, Failure> {
  /** Records `call` and returns the failure scripted for it, or undefined when it should succeed. */
  record(call: Call): Failure | undefined;
}

/** Starts the call log and failure script for one fake. */
export function createRecorder<Call, Failure>(): Recorder<Call, Failure> {
  const calls: Call[] = [];
  const failures: Failure[] = [];
  return {
    calls,
    failNext(failure) {
      failures.push(failure);
    },
    record(call) {
      calls.push(call);
      return failures.shift();
    },
  };
}
