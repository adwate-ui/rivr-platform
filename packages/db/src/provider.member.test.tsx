import { cleanup, render, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RivrDataProvider } from './provider.tsx';
import { ARJUN, fireChange, freshDatabase, heardOn, Probe, testClient } from './test/liveProvider.tsx';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

// The member app's live updates (#903): the person's own rows only, never the venue's a staff role would let them read.
describe('RivrDataProvider with ownRowsOnly', () => {
  it('hears only the person\u2019s own rows, never the venue\u2019s a staff role reads', async () => {
    const { client, channels } = testClient({ ...freshDatabase(), memberIds: ['m1', 'm2'] }, ARJUN);
    render(<RivrDataProvider client={client} ownRowsOnly><Probe /></RivrDataProvider>);
    await waitFor(() => expect(channels).toHaveLength(1));
    expect(heardOn(channels[0])).toEqual([
      ['tier_feature', 'every row'], ['member_feature_override', 'member_id=in.(m1,m2)'], ['member', `user_id=eq.${ARJUN}`],
      ['bonus_grant', 'member_id=in.(m1,m2)'], ['bonus_redemption', 'member_id=in.(m1,m2)'],
    ]);
  });

  it('tries its own rows again when the read fails, then hears them', async () => {
    const { client, channels } = testClient({ ...freshDatabase(), memberIds: ['m1'], memberIdsFail: 1 }, ARJUN);
    render(<RivrDataProvider client={client} ownRowsOnly><Probe /></RivrDataProvider>);
    await waitFor(() => expect(channels).toHaveLength(1), { timeout: 5000 });
    expect(heardOn(channels[0])?.map(([, filter]) => filter)).toContain('member_id=in.(m1)');
  });

  it('hears its own member row alone before sign-up makes it, then its Bonus too', async () => {
    const database = freshDatabase();
    const { client, channels } = testClient(database, ARJUN);
    render(<RivrDataProvider client={client} ownRowsOnly><Probe /></RivrDataProvider>);
    await waitFor(() => expect(channels).toHaveLength(1));
    expect(heardOn(channels[0])?.map(([table]) => table)).toEqual(['tier_feature', 'member']);
    database.memberIds = ['m1'];
    const [first] = channels;
    if (first === undefined) throw new Error('The provider opened no Realtime channel');
    fireChange(first, 'member');
    await waitFor(() => expect(channels).toHaveLength(2));
    expect(heardOn(channels[1])?.map(([table]) => table)).toEqual(['tier_feature', 'member_feature_override', 'member', 'bonus_grant', 'bonus_redemption']);
  });
});
