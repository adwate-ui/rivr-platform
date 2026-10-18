import { err, ok } from '@rivr/contracts';
import { describe, expect, it } from 'vitest';
import { backoffSeconds, runConsumer, type ClaimedDelivery, type Consumer, type OutboxStore } from './dispatch.ts';

function delivery(id: string, attempts = 1): ClaimedDelivery {
  return { deliveryId: id, eventId: `event-${id}`, venueId: 'venue', eventType: 'visit.closed', payload: {}, attempts };
}

/** A store that hands out `batch` once and records every finish. */
function fakeStore(batch: ClaimedDelivery[]) {
  const finished: Parameters<OutboxStore['finish']>[0][] = [];
  const claims: Parameters<OutboxStore['claim']>[0][] = [];
  const store: OutboxStore = {
    claim: async (input) => {
      claims.push(input);
      return batch;
    },
    finish: async (input) => {
      finished.push(input);
    },
  };
  return { store, finished, claims };
}

function consumer(deliver: Consumer['deliver']): Consumer {
  return { name: 'feedback', eventTypes: ['visit.closed'], isMessaging: true, deliver };
}

describe('backoffSeconds', () => {
  it('doubles from a minute and stops at six hours', () => {
    expect([1, 2, 3, 4].map(backoffSeconds)).toEqual([60, 120, 240, 480]);
    expect(backoffSeconds(10)).toBe(6 * 60 * 60);
  });
});

describe('runConsumer', () => {
  it('claims its events and finishes each delivery as delivered', async () => {
    const { store, finished, claims } = fakeStore([delivery('a'), delivery('b')]);

    expect(await runConsumer(store, consumer(async () => ok(null)))).toEqual({ delivered: 2, failed: 0 });
    expect(claims).toEqual([{ consumer: 'feedback', eventTypes: ['visit.closed'], isMessaging: true, limit: 20 }]);
    expect(finished.map((finish) => [finish.deliveryId, finish.isDelivered])).toEqual([['a', true], ['b', true]]);
  });

  it('finishes a failure with its reason and a backoff that grows with the attempts', async () => {
    const { store, finished } = fakeStore([delivery('a', 1), delivery('b', 3)]);

    const outcome = await runConsumer(store, consumer(async (claimed) => (claimed.deliveryId === 'a' ? err({ code: 'rate_limited' }) : err({ code: 'unavailable' }))));

    expect(outcome).toEqual({ delivered: 0, failed: 2 });
    expect(finished).toEqual([
      { deliveryId: 'a', isDelivered: false, error: 'rate_limited', retryAfterSeconds: 60 },
      { deliveryId: 'b', isDelivered: false, error: 'unavailable', retryAfterSeconds: 240 },
    ]);
  });

  it('never tries again a delivery the vendor rejected', async () => {
    const { store, finished } = fakeStore([delivery('a', 1)]);

    await runConsumer(store, consumer(async () => err({ code: 'rejected', reason: 'template not approved' })));

    expect(finished).toEqual([{ deliveryId: 'a', isDelivered: false, error: 'rejected: template not approved', retryAfterSeconds: null }]);
  });

  it('counts a delivery that throws as unavailable, and carries on with the rest', async () => {
    const { store, finished } = fakeStore([delivery('a'), delivery('b')]);

    const outcome = await runConsumer(store, consumer((claimed) => {
      // Not async: it throws before any promise exists, as a payload check can.
      if (claimed.deliveryId === 'a') throw new Error('bad payload');
      return Promise.resolve(ok(null));
    }));

    expect(outcome).toEqual({ delivered: 1, failed: 1 });
    expect(finished.map((finish) => [finish.deliveryId, finish.error])).toEqual([['a', 'unavailable'], ['b', null]]);
  });
});
