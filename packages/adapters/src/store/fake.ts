import { err, ok } from '@rivr/contracts';
import type { AdapterFailure } from '../shared/failure.ts';
import { createRecorder, type FakeControls } from '../shared/recorder.ts';
import type { StoreAdapter, StoreProduct } from './types.ts';

/** The fake store with its call log and failure script. */
export type FakeStore = StoreAdapter & FakeControls<{ readonly method: 'listProducts' }, AdapterFailure>;

/**
 * A store that sells only what a test stocks it with. Empty by default, so a real venue without
 * store credentials shows the empty state rather than invented products.
 */
export function createFakeStore(options: { readonly products?: readonly StoreProduct[] } = {}): FakeStore {
  const recorder = createRecorder<{ readonly method: 'listProducts' }, AdapterFailure>();
  return {
    calls: recorder.calls,
    failNext: (failure) => recorder.failNext(failure),
    async listProducts() {
      const failure = recorder.record({ method: 'listProducts' });
      return failure ? err(failure) : ok(options.products ?? []);
    },
  };
}
