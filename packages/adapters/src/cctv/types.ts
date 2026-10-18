import type { Result } from '@rivr/contracts';
import type { AdapterFailure } from '../shared/failure.ts';

/** The CCTV recorder: a playback link for a camera at the moment of a hand, transaction or incident. */
export interface CctvAdapter {
  /** A link that plays `cameraId`'s recording from `at`. */
  playbackLink(input: { readonly cameraId: string; readonly at: Date }): Promise<Result<{ readonly url: string }, AdapterFailure>>;
}
