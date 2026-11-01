import { memberIdSchema, ok } from '@rivr/contracts';
import { z } from 'zod';
import type { Consumer } from '../outbox/index.ts';
import type { CrmAdapter, CrmContact } from './types.ts';

/**
 * The events after which a member's contact is brought up to date (#647): signing up, saving the sign-up answers, the
 * identity check, each visit's end, and the one-off member.crm_sync that brings every member over (queue_crm_sync); and
 * member.erased, after which it is deleted.
 */
export const CRM_EVENT_TYPES = ['member.signed_up', 'member.answers_saved', 'kyc.completed', 'visit.closed', 'member.crm_sync', 'member.erased'] as const;

const erasedPayload = z.object({ member_id: memberIdSchema });

const contactRows = z.array(z.object({
  member_id: memberIdSchema,
  member_number: z.coerce.number(),
  full_name: z.string(),
  phone: z.string(),
  city: z.string().nullable(),
  occupation: z.string().nullable(),
  play_times: z.array(z.string()),
  games_played: z.array(z.string()),
  kyc_status: z.string(),
  tier_name: z.string(),
  seconds_played: z.coerce.number(),
  last_visit_at: z.string().nullable(),
}));

/** crm_contact's answer: the member's contact, or null when there is none to send (erased, or not at this venue). */
export function crmContactFrom(rows: unknown): CrmContact | null {
  const row = contactRows.parse(rows)[0];
  if (row === undefined) return null;
  return {
    memberId: row.member_id, memberNumber: row.member_number, fullName: row.full_name, phone: row.phone, city: row.city, occupation: row.occupation,
    playTimes: row.play_times, gamesPlayed: row.games_played, kycStatus: row.kyc_status, tier: row.tier_name, secondsPlayed: row.seconds_played,
    lastVisitAt: row.last_visit_at === null ? null : new Date(row.last_visit_at),
  };
}

export type FindCrmContact = (venueId: string, payload: unknown) => Promise<CrmContact | null>;

/**
 * The CRM outbox consumer (#647): after each event above, the member's contact as the database has it now, upserted to the
 * club's CRM; after an erasure, the contact deleted. Not a messaging consumer, so a messaging stop does not hold it;
 * practice-venue events never reach it. A member with no contact to send (erased) is finished unsent.
 */
export function createCrmConsumer({ find, crm }: { find: FindCrmContact; crm: CrmAdapter }): Consumer {
  return {
    name: 'crm-sync',
    eventTypes: CRM_EVENT_TYPES,
    isMessaging: false,
    async deliver(delivery) {
      if (delivery.eventType === 'member.erased') {
        const deleted = await crm.deleteContact(erasedPayload.parse(delivery.payload).member_id);
        return deleted.ok ? ok(null) : deleted;
      }
      const contact = await find(delivery.venueId, delivery.payload);
      if (contact === null) return ok(null);
      const upserted = await crm.upsertContact(contact);
      return upserted.ok ? ok(null) : upserted;
    },
  };
}
