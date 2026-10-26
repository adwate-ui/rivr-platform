// The signed-in member a kyc request is for, and the KYC vendor their venue gets.
import { createAdapters, createFakeKyc } from '@rivr/adapters';
import { memberIdSchema, venueIdSchema, type MemberId, type VenueId } from '@rivr/contracts';
import { cashfreeKyc } from './cashfree.ts';
import { rpc } from './server.ts';

export type Kyc = ReturnType<typeof createAdapters>['kyc'];

export interface Subject {
  readonly memberId: MemberId;
  readonly venueId: VenueId;
  /** As the venue registered it: DigiLocker's name and a PAN are checked against it. */
  readonly fullName: string;
  readonly kyc: Kyc;
}

/** The signed-in member this request is for, or null for staff and the public. */
export async function subjectFor(token: string): Promise<Subject | null> {
  const rows = await rpc('kyc_subject', {}, token).catch(() => []);
  const row: unknown = Array.isArray(rows) ? rows[0] : undefined;
  if (typeof row !== 'object' || row === null) return null;
  const fullName = String(Reflect.get(row, 'full_name'));
  // The practice venue gets the fake vendor (decision 0014), whose DigiLocker returns the member's own
  // name, as DigiLocker does for the right person. A real venue gets Cashfree when its keys are set
  // (decision 0197), and otherwise KYC stays closed.
  const kyc =
    Reflect.get(row, 'is_practice') === true
      ? createFakeKyc({ record: { name: fullName } })
      : createAdapters({ isPracticeVenue: false, live: { kyc: cashfreeKyc() } }).kyc;
  return {
    memberId: memberIdSchema.parse(Reflect.get(row, 'member_id')),
    venueId: venueIdSchema.parse(Reflect.get(row, 'venue_id')),
    fullName,
    kyc,
  };
}
