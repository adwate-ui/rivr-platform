import { describe, expect, it } from 'vitest';
import { createFakeLiveStatus } from '../live-status/fake.ts';
import type { ClaimedDelivery } from '../outbox/index.ts';
import { createNativePushConsumer, type FindNativePushTargets, type NativePhone } from './nativePushConsumer.ts';

const MEMBER = '00000000-0000-4000-8000-000000000211';
const SESSION = '00000000-0000-4000-8000-0000000005e1';
const PROMOTION = '00000000-0000-4000-8000-0000000005e4';
const VENUE = 'v1';
const IPHONE: NativePhone = { deviceId: 'd1', platform: 'ios', token: 'a1'.repeat(32) };
const ANDROID: NativePhone = { deviceId: 'd2', platform: 'android', token: 'dXk3:APA91bHPRgkF3JUikC4ENAHEeMrd41Zxv' };

const now = () => new Date('2026-11-15T18:50:00Z');
const delivery = (eventType: string, payload: unknown): ClaimedDelivery => ({ deliveryId: 'd1', eventId: 'e1', venueId: VENUE, eventType, payload, attempts: 1, occurredAt: now() });
const BONUS = { member_id: MEMBER, bonus_grant_id: '00000000-0000-4000-8000-0000000005e3', amount_paise: 50_000, reason: 'Welcome bonus' };
const ENDING = { member_id: MEMBER, session_id: SESSION, table_name: 'Table 1', seat: 4, ends_at: '2026-11-15T19:05:00.123456+00:00' };

/** A consumer over a member with these phones; what reached them, what was forgotten and what was asked. */
function consumerFor(phones: readonly NativePhone[], off: readonly (string | null)[] = []) {
  const alerts = createFakeLiveStatus();
  const forgotten: string[] = [];
  const promotions: (string | undefined)[] = [];
  const findTargets: FindNativePushTargets = async (venueId, memberId, pushType, promotionId) => {
    promotions.push(promotionId);
    return venueId === VENUE && memberId === MEMBER && !off.includes(pushType) ? phones : [];
  };
  const consumer = createNativePushConsumer({ alerts, findTargets, forget: async (deviceId) => { forgotten.push(deviceId); }, now });
  return { consumer, alerts, forgotten, promotions };
}

describe('the native push consumer', () => {
  it('is a messaging consumer of every push but the seat call, which the live status already sounds', () => {
    const { consumer } = consumerFor([]);
    expect([consumer.name, consumer.isMessaging, consumer.eventTypes.includes('waitlist.called'), consumer.eventTypes.includes('call_time.ending')])
      .toEqual(['native_push', true, false, true]);
  });

  it('sends a push once to an iPhone and once to an Android phone', async () => {
    const { consumer, alerts } = consumerFor([IPHONE, ANDROID]);
    const outcome = await consumer.deliver(delivery('bonus.credited', BONUS));
    expect(outcome.ok).toBe(true);
    expect(alerts.alerts.map(({ platform, token }) => [platform, token])).toEqual([['ios', IPHONE.token], ['android', ANDROID.token]]);
    expect(alerts.alerts[0]).toMatchObject({ id: 'e1', url: '/rewards', tag: `bonus-${BONUS.bonus_grant_id}` });
  });

  it('sends Call time ending', async () => {
    const { consumer, alerts } = consumerFor([IPHONE]);
    await consumer.deliver(delivery('call_time.ending', ENDING));
    expect(alerts.alerts).toHaveLength(1);
    expect(alerts.alerts[0]).toMatchObject({ url: '/', tag: `call-time-${SESSION}` });
  });

  it('asks for a promotion offer by its promotion', async () => {
    const { consumer, promotions } = consumerFor([IPHONE]);
    await consumer.deliver(delivery('promotion.offered', { member_id: MEMBER, promotion_id: PROMOTION, title: 'Double points', detail: null, runs: null }));
    expect(promotions).toEqual([PROMOTION]);
  });

  it('reaches no phone for a kind the member does not want', async () => {
    const { consumer, alerts } = consumerFor([IPHONE], ['push.bonus']);
    await consumer.deliver(delivery('bonus.credited', BONUS));
    expect(alerts.alerts).toEqual([]);
  });

  it('forgets a phone the push service no longer knows, and is not a failure', async () => {
    const { consumer, alerts, forgotten } = consumerFor([IPHONE]);
    alerts.failNextAlert({ code: 'device_gone' });
    const outcome = await consumer.deliver(delivery('bonus.credited', BONUS));
    expect([outcome.ok, forgotten]).toEqual([true, ['d1']]);
  });

  it('skips a kind of phone without credentials', async () => {
    const { consumer, alerts, forgotten } = consumerFor([IPHONE]);
    alerts.failNextAlert({ code: 'not_configured' });
    const outcome = await consumer.deliver(delivery('bonus.credited', BONUS));
    expect([outcome.ok, forgotten]).toEqual([true, []]);
  });

  it('tries again when a push service is down', async () => {
    const { consumer, alerts } = consumerFor([IPHONE]);
    alerts.failNextAlert({ code: 'unavailable' });
    expect(await consumer.deliver(delivery('bonus.credited', BONUS))).toEqual({ ok: false, error: { code: 'unavailable' } });
  });

  it('keeps a failure worth trying again over a phone that was refused', async () => {
    const { consumer, alerts } = consumerFor([IPHONE, ANDROID]);
    alerts.failNextAlert({ code: 'unavailable' });
    alerts.failNextAlert({ code: 'rejected', reason: 'No' });
    expect(await consumer.deliver(delivery('bonus.credited', BONUS))).toEqual({ ok: false, error: { code: 'unavailable' } });
  });
});
