import { err, ok } from '@rivr/contracts';
import type { AdapterFailure } from '../shared/failure.ts';
import { createRecorder, type FakeControls } from '../shared/recorder.ts';
import { toMetaServerEvent } from './server-event.ts';
import type { MetaConversionsAdapter, MetaServerEvent } from './types.ts';

/** The fake Conversions API. Its call log holds the hashed events Meta would receive, never raw ones. */
export type FakeMetaConversions = MetaConversionsAdapter & FakeControls<MetaServerEvent, AdapterFailure>;

/** A Conversions API that sends nothing and keeps the hashed events. */
export function createFakeMetaConversions(): FakeMetaConversions {
  const recorder = createRecorder<MetaServerEvent, AdapterFailure>();
  return {
    calls: recorder.calls,
    failNext: (failure) => recorder.failNext(failure),
    async send(event) {
      const failure = recorder.record(await toMetaServerEvent(event));
      return failure ? err(failure) : ok({ eventsReceived: 1 });
    },
  };
}
