import type { MemberId, Result } from '@rivr/contracts';
import type { AdapterFailure } from '../shared/failure.ts';

/**
 * A member as a contact in the club's CRM (#647): who they are, what they answered at sign-up, their identity check, tier,
 * hours played and last visit. The CRM keys the contact by the member's id; filtering, sorting and the full record live
 * there, never in the console (the owner: "don't build a CRM - just build integration").
 */
export interface CrmContact {
  readonly memberId: MemberId;
  readonly memberNumber: number;
  readonly fullName: string;
  /** E.164, `+919876543210`. */
  readonly phone: string;
  readonly city: string | null;
  readonly occupation: string | null;
  readonly playTimes: readonly string[];
  readonly gamesPlayed: readonly string[];
  /** `verified`, `needs_review`, `refused`, `started`, or `none` before any check. */
  readonly kycStatus: string;
  readonly tier: string;
  /** Whole seconds at the tables, all visits. */
  readonly secondsPlayed: number;
  readonly lastVisitAt: Date | null;
}

/** The club's CRM. The practice venue never reaches it: its events are never claimed (claim_outbox_deliveries). */
export interface CrmAdapter {
  /** Creates the member's contact, or updates the one keyed by their id. */
  upsertContact(contact: CrmContact): Promise<Result<{ readonly id: string }, AdapterFailure>>;
  /** Deletes the member's contact for good, on their erasure; none there is done too. */
  deleteContact(memberId: MemberId): Promise<Result<null, AdapterFailure>>;
}
