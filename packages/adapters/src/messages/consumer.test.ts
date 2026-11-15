import { indianMobileSchema } from '@rivr/contracts';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import type { ClaimedDelivery } from '../outbox/index.ts';
import { createWhatsAppEvolution } from '../whatsapp/evolution.ts';
import { createFakeWhatsApp } from '../whatsapp/fake.ts';
import { createWhatsAppConsumer, type FindErasedPhone, type FindRecipient } from './consumer.ts';

const MEMBER = '00000000-0000-4000-8000-000000000211';
const phone = indianMobileSchema.parse('+919000000211');
const VENUE = 'v1';
const recipient = { phone, marketingOptedInAt: null, firstName: 'Neha', memberNumber: '1042' };
const findRecipient: FindRecipient = async (venueId, memberId) => (venueId === VENUE && memberId === MEMBER ? recipient : null);
const findErasedPhone: FindErasedPhone = async () => null;

// Ten minutes before the hold in these calls runs out.
const now = () => new Date('2026-11-15T18:50:00Z');

function delivery(eventType: string, payload: unknown, occurredAt?: Date): ClaimedDelivery {
  return { deliveryId: 'd1', eventId: 'e1', venueId: VENUE, eventType, payload, attempts: 1, ...(occurredAt === undefined ? {} : { occurredAt }) };
}

describe('the WhatsApp consumer', () => {
  it('is a messaging consumer of the seat call, promotion offers, review requests, member notices and sign-ups, so a messaging stop holds it', () => {
    const consumer = createWhatsAppConsumer({ whatsapp: createFakeWhatsApp(), findRecipient, findErasedPhone, now });
    expect([consumer.name, consumer.isMessaging, consumer.eventTypes])
      .toEqual(['whatsapp', true, ['waitlist.called', 'promotion.offered', 'review.requested', 'member.notice', 'member.signed_up']]);
  });

  it('tells a member, by a utility message, what happened while they were away from the app (decision 0303)', async () => {
    const whatsapp = createFakeWhatsApp();
    const consumer = createWhatsAppConsumer({ whatsapp, findRecipient, findErasedPhone, now });
    const notices = [
      { notice: 'kyc_verified', params: [] },
      { notice: 'kyc_in_review', params: [] },
      { notice: 'seat_released', params: ['Table 3', '4'] },
    ];
    for (const notice of notices) expect((await consumer.deliver(delivery('member.notice', { member_id: MEMBER, ...notice }, now()))).ok).toBe(true);
    expect(whatsapp.calls).toEqual(notices.map(({ notice, params }) => ({ category: 'utility', to: phone, template: notice, params })));
  });

  it('sends the club’s notification of a tournament, its start as a day and time in words (redesign RD-26)', async () => {
    const whatsapp = createFakeWhatsApp();
    const consumer = createWhatsAppConsumer({ whatsapp, findRecipient, findErasedPhone, now });
    await consumer.deliver(delivery('member.notice', { member_id: MEMBER, notice: 'tournament_starts', params: ['Sunday Cup', '2026-11-22T13:30:00+00:00'] }, now()));
    expect(whatsapp.calls.map((call) => [call.category, call.template, call.params])).toEqual([['utility', 'tournament_starts', ['Sunday Cup', 'Sun 22 Nov, 19:00']]]);
  });

  it('tells a member a tournament is withdrawn, or has moved, with its new day and time in words (the owner, 9 Nov)', async () => {
    const whatsapp = createFakeWhatsApp();
    const consumer = createWhatsAppConsumer({ whatsapp, findRecipient, findErasedPhone, now });
    await consumer.deliver(delivery('member.notice', { member_id: MEMBER, notice: 'tournament_withdrawn', params: ['Sunday Cup'] }, now()));
    await consumer.deliver(delivery('member.notice', { member_id: MEMBER, notice: 'tournament_moved', params: ['Sunday Cup', '2026-11-22T13:30:00+00:00'] }, now()));
    expect(whatsapp.calls.map((call) => [call.category, call.template, call.params])).toEqual([
      ['utility', 'tournament_withdrawn', ['Sunday Cup']], ['utility', 'tournament_moved', ['Sunday Cup', 'Sun 22 Nov, 19:00']],
    ]);
  });

  it('keeps a tournament notice worth sending for two days: a withdrawn one has left the list, so the app does not say so', async () => {
    const hoursAgo = (hours: number) => new Date(now().getTime() - hours * 60 * 60 * 1000);
    const whatsapp = createFakeWhatsApp();
    const consumer = createWhatsAppConsumer({ whatsapp, findRecipient, findErasedPhone, now });
    const withdrawn = { member_id: MEMBER, notice: 'tournament_withdrawn', params: ['Sunday Cup'] };
    await consumer.deliver(delivery('member.notice', withdrawn, hoursAgo(47)));
    expect(whatsapp.calls).toHaveLength(1);
    await consumer.deliver(delivery('member.notice', withdrawn, hoursAgo(49)));
    expect(whatsapp.calls).toHaveLength(1);
    await consumer.deliver(delivery('member.notice', { member_id: MEMBER, notice: 'kyc_verified', params: [] }, hoursAgo(7)));
    expect(whatsapp.calls).toHaveLength(1);
  });

  it('puts a refusal in words by its code, never a reviewer\u2019s note', async () => {
    const whatsapp = createFakeWhatsApp();
    const consumer = createWhatsAppConsumer({ whatsapp, findRecipient, findErasedPhone, now });
    await consumer.deliver(delivery('member.notice', { member_id: MEMBER, notice: 'kyc_refused', params: ['staff_rejected'] }, now()));
    await consumer.deliver(delivery('member.notice', { member_id: MEMBER, notice: 'kyc_refused', params: ['something_new'] }, now()));
    expect(whatsapp.calls.map((call) => [call.template, call.params])).toEqual([
      ['kyc_refused', ['your details did not match']], ['kyc_refused', ['your details could not be confirmed']],
    ]);
  });

  it('tells an under-18 refusal only the age rule, in its own text, sending them to no desk (8 Nov audit, F-049)', async () => {
    const whatsapp = createFakeWhatsApp();
    const consumer = createWhatsAppConsumer({ whatsapp, findRecipient, findErasedPhone, now });
    await consumer.deliver(delivery('member.notice', { member_id: MEMBER, notice: 'kyc_refused', params: ['under_18'] }, now()));
    expect(whatsapp.calls).toEqual([{ category: 'utility', to: phone, template: 'kyc_under_age', params: [] }]);
  });

  it('says an account is deleted to the number kept for that message alone, the member being gone (decision 0574)', async () => {
    const whatsapp = createFakeWhatsApp();
    const noMember: FindRecipient = async () => null;
    const kept: FindErasedPhone = async (venueId, memberId) => (venueId === VENUE && memberId === MEMBER ? phone : null);
    const consumer = createWhatsAppConsumer({ whatsapp, findRecipient: noMember, findErasedPhone: kept, now });
    const outcome = await consumer.deliver(delivery('member.notice', { member_id: MEMBER, notice: 'account_erased', params: [] }, now()));
    expect([outcome.ok, whatsapp.calls]).toEqual([true, [{ category: 'utility', to: phone, template: 'account_erased', params: [] }]]);
  });

  it('sends nothing, and reports nothing wrong, once the kept number is forgotten', async () => {
    const whatsapp = createFakeWhatsApp();
    const consumer = createWhatsAppConsumer({ whatsapp, findRecipient, findErasedPhone, now });
    const outcome = await consumer.deliver(delivery('member.notice', { member_id: MEMBER, notice: 'account_erased', params: [] }, now()));
    expect([outcome.ok, whatsapp.calls]).toEqual([true, []]);
  });

  it('sends no notice claimed long after it happened, as when WhatsApp is switched on, nor one of no known time', async () => {
    const whatsapp = createFakeWhatsApp();
    const consumer = createWhatsAppConsumer({ whatsapp, findRecipient, findErasedPhone, now });
    const verified = { member_id: MEMBER, notice: 'kyc_verified', params: [] };
    const late = await consumer.deliver(delivery('member.notice', verified, new Date('2026-11-15T10:00:00Z')));
    const untimed = await consumer.deliver(delivery('member.notice', verified));
    const badly = await consumer.deliver(delivery('member.notice', verified, new Date('not a time')));
    expect([late.ok, untimed.ok, badly.ok, whatsapp.calls]).toEqual([true, true, true, []]);
  });

  it('refuses, for good, a notice whose words carry a link or another line, so nothing typed reads as the club\u2019s', async () => {
    const whatsapp = createFakeWhatsApp();
    const consumer = createWhatsAppConsumer({ whatsapp, findRecipient, findErasedPhone, now });
    for (const word of ['Pay at https://example.com', 'Cap\nPay now', '*Urgent*']) {
      const outcome = await consumer.deliver(delivery('member.notice', { member_id: MEMBER, notice: 'seat_released', params: [word, '4'] }, now()));
      expect(outcome.ok).toBe(false);
    }
    expect(whatsapp.calls).toEqual([]);
  });

  it('welcomes someone who signed up, in the owner\u2019s words, with the first word of their name and their member number (decision 0661)', async () => {
    const texts: string[] = [];
    const fetch: typeof globalThis.fetch = async (_input, init = {}) => {
      texts.push(z.object({ text: z.string() }).parse(JSON.parse(String(init.body))).text);
      return Response.json({ key: { id: 'welcome-1' } }, { status: 201 });
    };
    const whatsapp = createWhatsAppEvolution({ baseUrl: 'https://wa.example.test', apiKey: 'test-key', instance: 'rivr test', fetch });
    const consumer = createWhatsAppConsumer({ whatsapp, findRecipient, findErasedPhone, now });
    const signedUp = { member_id: MEMBER, utm_source: 'instagram' };

    expect(await consumer.deliver(delivery('member.signed_up', signedUp, now()))).toEqual({ ok: true, value: { messageId: 'welcome-1' } });
    expect(texts).toEqual(['Hi Neha, congratulations on becoming a member of RIVR poker club. Your membership ID is: 1042.']);
  });

  it('sends no welcome claimed over six hours after the sign-up, as when it began, and refuses one for a member no longer there', async () => {
    const whatsapp = createFakeWhatsApp();
    const consumer = createWhatsAppConsumer({ whatsapp, findRecipient, findErasedPhone, now });
    const hoursAgo = (hours: number) => new Date(now().getTime() - hours * 60 * 60 * 1000);

    expect(await consumer.deliver(delivery('member.signed_up', { member_id: MEMBER }, hoursAgo(7)))).toEqual({ ok: true, value: null });
    expect(await consumer.deliver(delivery('member.signed_up', { member_id: MEMBER }))).toEqual({ ok: true, value: null });
    const gone = await consumer.deliver(delivery('member.signed_up', { member_id: '00000000-0000-4000-8000-000000000999' }, now()));
    expect(gone).toMatchObject({ ok: false, error: { code: 'rejected' } });
    expect(await consumer.deliver(delivery('member.signed_up', {}, now()))).toMatchObject({ ok: false, error: { code: 'rejected' } });
    expect(whatsapp.calls).toEqual([]);
    await consumer.deliver(delivery('member.signed_up', { member_id: MEMBER }, hoursAgo(5)));
    expect(whatsapp.calls).toEqual([{ category: 'utility', to: phone, template: 'member_welcome', params: ['Neha', '1042'] }]);
  });

  it('sends the seat call: the table, the seat and when the hold expires, in IST', async () => {
    const whatsapp = createFakeWhatsApp();
    const consumer = createWhatsAppConsumer({ whatsapp, findRecipient, findErasedPhone, now });
    const called = { member_id: MEMBER, table_name: 'Table 3', seat: 9, hold_until: '2026-11-15T19:00:00+00:00' };

    expect((await consumer.deliver(delivery('waitlist.called', called))).ok).toBe(true);
    expect(whatsapp.calls).toEqual([{ category: 'utility', to: phone, template: 'seat_ready', params: ['Table 3', '9', '00:30'] }]);
  });

  it('rejects, for good, a payload it cannot read, a member no longer there, or an event it does not send', async () => {
    const whatsapp = createFakeWhatsApp();
    const consumer = createWhatsAppConsumer({ whatsapp, findRecipient, findErasedPhone, now });
    const gone = { member_id: '00000000-0000-4000-8000-000000000999', table_name: 'Table 3', seat: 9, hold_until: '2026-11-15T19:00:00+00:00' };

    expect(await consumer.deliver(delivery('waitlist.called', { member_id: MEMBER }))).toMatchObject({ ok: false, error: { code: 'rejected' } });
    expect(await consumer.deliver(delivery('waitlist.called', gone))).toMatchObject({ ok: false, error: { code: 'rejected' } });
    expect(await consumer.deliver(delivery('seat.taken', {}))).toMatchObject({ ok: false, error: { code: 'rejected' } });
    expect(whatsapp.calls).toEqual([]);
  });

  it('handles a seat call claimed after its hold ran out without sending it, and without failing it', async () => {
    const whatsapp = createFakeWhatsApp();
    const late = createWhatsAppConsumer({ whatsapp, findRecipient, findErasedPhone, now: () => new Date('2026-11-15T19:00:00Z') });
    const called = { member_id: MEMBER, table_name: 'Table 3', seat: 9, hold_until: '2026-11-15T19:00:00+00:00' };
    expect(await late.deliver(delivery('waitlist.called', called))).toEqual({ ok: true, value: null });
    expect(whatsapp.calls).toEqual([]);
  });

  it('finds the member only at the event\'s venue', async () => {
    const whatsapp = createFakeWhatsApp();
    const consumer = createWhatsAppConsumer({ whatsapp, findRecipient, findErasedPhone, now });
    const called = { member_id: MEMBER, table_name: 'Table 3', seat: 9, hold_until: '2026-11-15T19:00:00+00:00' };
    expect(await consumer.deliver({ ...delivery('waitlist.called', called), venueId: 'elsewhere' })).toMatchObject({ ok: false, error: { code: 'rejected' } });
    expect(whatsapp.calls).toEqual([]);
  });

  it('passes on WhatsApp\'s own failure, so the outbox retries it', async () => {
    const whatsapp = createFakeWhatsApp();
    whatsapp.failNext({ code: 'unavailable' });
    const consumer = createWhatsAppConsumer({ whatsapp, findRecipient, findErasedPhone, now });
    const called = { member_id: MEMBER, table_name: 'Table 3', seat: 9, hold_until: '2026-11-15T19:00:00+00:00' };
    expect(await consumer.deliver(delivery('waitlist.called', called))).toEqual({ ok: false, error: { code: 'unavailable' } });
  });

  it('asks for a Google review as a marketing message, with the venue\'s link, only to a member who opted in', async () => {
    const optedIn = new Date('2026-10-01T10:00:00Z');
    const whatsapp = createFakeWhatsApp();
    const review = { review_request_id: '00000000-0000-4000-8000-000000000b01', member_id: MEMBER, url: 'https://g.page/r/rivr-gurugram/review' };

    const asking = createWhatsAppConsumer({ whatsapp, now, findErasedPhone, findRecipient: async () => ({ ...recipient, marketingOptedInAt: optedIn }) });
    expect((await asking.deliver(delivery('review.requested', review))).ok).toBe(true);
    expect(whatsapp.calls).toEqual([{ category: 'marketing', optedInAt: optedIn, to: phone, template: 'review_request', params: [review.url] }]);

    const notOptedIn = createWhatsAppConsumer({ whatsapp, findRecipient, findErasedPhone, now });
    expect(await notOptedIn.deliver(delivery('review.requested', review))).toEqual({ ok: true, value: null });
    expect(await notOptedIn.deliver(delivery('review.requested', { ...review, url: 'http://insecure.example' }))).toMatchObject({ ok: false });
    expect(whatsapp.calls).toHaveLength(1);
  });

  it('sends a promotion offer as the marketing template, with the member\'s opt-in, and nothing once they opted out or it stopped running (#86)', async () => {
    const optedIn = new Date('2026-10-01T10:00:00Z');
    const whatsapp = createFakeWhatsApp();
    const asked: (string | undefined)[] = [];
    const consumer = createWhatsAppConsumer({ whatsapp, now, findErasedPhone, findRecipient: async (_venueId, _memberId, offeredPromotionId) => {
      asked.push(offeredPromotionId);
      return { ...recipient, marketingOptedInAt: optedIn };
    } });
    const offer = { promotion_id: '00000000-0000-4000-8000-000000000a01', member_id: MEMBER, title: 'Thursday bonus', detail: null, runs: 'NLH 100/200 · Thursday, 14:00 to 20:00' };

    expect((await consumer.deliver(delivery('promotion.offered', offer))).ok).toBe(true);
    expect(whatsapp.calls).toEqual([{ category: 'marketing', optedInAt: optedIn, to: phone, template: 'promotion', params: ['Thursday bonus · NLH 100/200 · Thursday, 14:00 to 20:00.'] }]);
    // The member is found for the offer's own promotion, so one no longer running finds nobody.
    expect(asked).toEqual([offer.promotion_id]);

    const withdrawn = createWhatsAppConsumer({ whatsapp, findRecipient, findErasedPhone, now });
    expect(await withdrawn.deliver(delivery('promotion.offered', offer))).toEqual({ ok: true, value: null });
    expect(await withdrawn.deliver(delivery('promotion.offered', { ...offer, title: '' }))).toMatchObject({ ok: false });
    const stopped = createWhatsAppConsumer({ whatsapp, now, findErasedPhone, findRecipient: async () => null });
    expect(await stopped.deliver(delivery('promotion.offered', offer))).toEqual({ ok: true, value: null });
    expect(whatsapp.calls).toHaveLength(1);
  });
});
