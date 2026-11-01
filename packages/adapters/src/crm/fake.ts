import { err, ok, type MemberId } from '@rivr/contracts';
import type { AdapterFailure } from '../shared/failure.ts';
import { createRecorder, type FakeControls } from '../shared/recorder.ts';
import type { CrmAdapter, CrmContact } from './types.ts';

/** What the fake CRM was asked: a contact to upsert, or a member's contact to delete. */
export type FakeCrmCall = { readonly upsert: CrmContact } | { readonly delete: MemberId };

/** The fake CRM: it keeps each contact it would have upserted, and each it would have deleted. */
export type FakeCrm = CrmAdapter & FakeControls<FakeCrmCall, AdapterFailure>;

/** A CRM that sends nothing and keeps its calls, each upserted contact given the member's id as its CRM id. */
export function createFakeCrm(): FakeCrm {
  const recorder = createRecorder<FakeCrmCall, AdapterFailure>();
  return {
    calls: recorder.calls,
    failNext: (failure) => recorder.failNext(failure),
    async upsertContact(contact) {
      const failure = recorder.record({ upsert: contact });
      return failure ? err(failure) : ok({ id: contact.memberId });
    },
    async deleteContact(memberId) {
      const failure = recorder.record({ delete: memberId });
      return failure ? err(failure) : ok(null);
    },
  };
}
