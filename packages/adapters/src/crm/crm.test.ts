import { describe, expect, it } from 'vitest';
import { createCrmConsumer, createFakeCrm, createHubSpotCrm, crmContactFrom, HUBSPOT_ID_PROPERTY, toHubSpotProperties, type CrmContact } from './index.ts';

const MEMBER = '00000000-0000-4000-8000-000000000213';

const ROW = {
  member_id: MEMBER, member_number: 1213, full_name: 'Mihir Shah', phone: '+919000000213', city: 'Gurugram', occupation: 'salaried',
  play_times: ['weekday_evenings', 'weekends'], games_played: ['plo'], kyc_status: 'verified', tier_name: 'Member', seconds_played: 9000,
  last_visit_at: '2026-10-31T15:30:00Z',
};

function contact(): CrmContact {
  const found = crmContactFrom([ROW]);
  if (found === null) throw new Error('no contact');
  return found;
}

const delivery = { deliveryId: 'd1', eventId: 'e1', venueId: 'v1', eventType: 'visit.closed', payload: { member_id: MEMBER }, attempts: 0, occurredAt: new Date() };

describe('the CRM sync', () => {
  it('reads the member\'s contact from the database, or none', () => {
    expect(contact()).toMatchObject({ memberId: MEMBER, fullName: 'Mihir Shah', tier: 'Member', secondsPlayed: 9000, lastVisitAt: new Date('2026-10-31T15:30:00Z') });
    expect(crmContactFrom([])).toBeNull();
  });

  it('gives HubSpot its own name, phone and city, and the club\'s properties, hours to a tenth', () => {
    expect(toHubSpotProperties(contact())).toEqual({
      firstname: 'Mihir', lastname: 'Shah', phone: '+919000000213', city: 'Gurugram', rivr_member_number: '1213', rivr_occupation: 'salaried',
      rivr_play_times: 'weekday_evenings;weekends', rivr_games: 'plo', rivr_kyc_status: 'verified', rivr_tier: 'Member', rivr_hours_played: '2.5',
      rivr_last_visit: '2026-10-31',
    });
  });

  it('upserts to HubSpot by the member\'s id, and says what HubSpot answered', async () => {
    const sent: { url: string; body: unknown; auth: string | null }[] = [];
    const answers = [Response.json({ results: [{ id: '501' }] }), new Response('', { status: 429 }), new Response('', { status: 401 })];
    const crm = createHubSpotCrm({
      accessToken: 'token',
      fetch: async (url, init) => {
        sent.push({ url: String(url), body: JSON.parse(String(init?.body)), auth: new Headers(init?.headers).get('authorization') });
        return answers.shift() ?? new Response('', { status: 503 });
      },
    });
    expect(await crm.upsertContact(contact())).toEqual({ ok: true, value: { id: '501' } });
    expect(sent[0]).toMatchObject({ url: 'https://api.hubapi.com/crm/v3/objects/contacts/batch/upsert', auth: 'Bearer token' });
    expect(sent[0]?.body).toMatchObject({ inputs: [{ idProperty: HUBSPOT_ID_PROPERTY, id: MEMBER }] });
    expect(await crm.upsertContact(contact())).toEqual({ ok: false, error: { code: 'rate_limited' } });
    expect(await crm.upsertContact(contact())).toEqual({ ok: false, error: { code: 'rejected', reason: 'HubSpot 401' } });
    expect(await crm.upsertContact(contact())).toEqual({ ok: false, error: { code: 'unavailable' } });
  });

  it('counts a contact HubSpot refused within the batch as refused', async () => {
    const crm = createHubSpotCrm({ accessToken: 'token', fetch: async () => Response.json({ errors: [{ message: 'Property does not exist' }] }, { status: 207 }) });
    expect(await crm.upsertContact(contact())).toEqual({ ok: false, error: { code: 'rejected', reason: 'HubSpot 207' } });
  });

  it('deletes an erased member\'s contact for good, by their id, a contact never sent too', async () => {
    const sent: { url: string; body: unknown }[] = [];
    const answers = [new Response(null, { status: 204 }), new Response('', { status: 404 }), new Response('', { status: 429 })];
    const crm = createHubSpotCrm({
      accessToken: 'token',
      fetch: async (url, init) => {
        sent.push({ url: String(url), body: JSON.parse(String(init?.body)) });
        return answers.shift() ?? new Response('', { status: 503 });
      },
    });
    expect(await crm.deleteContact(contact().memberId)).toEqual({ ok: true, value: null });
    expect(sent[0]).toEqual({ url: 'https://api.hubapi.com/crm/v3/objects/contacts/gdpr-delete', body: { objectId: MEMBER, idProperty: HUBSPOT_ID_PROPERTY } });
    expect(await crm.deleteContact(contact().memberId)).toEqual({ ok: true, value: null });
    expect(await crm.deleteContact(contact().memberId)).toEqual({ ok: false, error: { code: 'rate_limited' } });
  });

  it('is unavailable when HubSpot cannot be reached, to be tried again', async () => {
    const crm = createHubSpotCrm({ accessToken: 'token', fetch: async () => { throw new TypeError('network down'); } });
    expect(await crm.upsertContact(contact())).toEqual({ ok: false, error: { code: 'unavailable' } });
  });

  it('upserts after each event, finishing unsent when there is no contact', async () => {
    const crm = createFakeCrm();
    const consumer = createCrmConsumer({ find: async () => contact(), crm });
    expect(consumer.eventTypes).toEqual(['member.signed_up', 'member.answers_saved', 'kyc.completed', 'visit.closed', 'member.crm_sync', 'member.erased']);
    expect(await consumer.deliver(delivery)).toEqual({ ok: true, value: null });
    expect(crm.calls).toEqual([{ upsert: contact() }]);
    crm.failNext({ code: 'unavailable' });
    expect(await consumer.deliver(delivery)).toEqual({ ok: false, error: { code: 'unavailable' } });
    const none = createCrmConsumer({ find: async () => null, crm });
    expect(await none.deliver(delivery)).toEqual({ ok: true, value: null });
    expect(crm.calls).toHaveLength(2);
  });

  it('deletes the contact after an erasure, never looking the member up', async () => {
    const crm = createFakeCrm();
    const consumer = createCrmConsumer({ find: async () => { throw new Error('an erased member is not looked up'); }, crm });
    expect(await consumer.deliver({ ...delivery, eventType: 'member.erased' })).toEqual({ ok: true, value: null });
    expect(crm.calls).toEqual([{ delete: MEMBER }]);
  });
});
