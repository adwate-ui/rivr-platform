import { createRivrClient, RivrDataProvider, SESSION_STORAGE_KEY, type MemberSignUp } from '@rivr/db';
import { QueryClient } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MemberReferrer } from './MemberReferrer.tsx';

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.unstubAllGlobals();
});

const SIGN_UP: MemberSignUp = {
  signedUpAt: '2026-11-10T10:00:00Z', city: null, occupation: null, playTimes: [], gamesPlayed: [], referralCode: null, creatorCode: null,
  campaign: { source: null, medium: null, campaign: null, content: null, term: null }, firstSeenAt: null,
  referrer: null, referralCompletedAt: null, hasSat: true,
};

const found = (id: string, name: string, number: number) => ({
  member_id: id, member_number: number, full_name: name, phone: null, tier_name: 'Black', visits: 3, last_visit_at: null,
});

/** Kabir's (m1) record for a staff member, against a fake API whose search finds Kabir and Rohan; every referrer set is kept. */
function renderReferrer(signUp: MemberSignUp, canSet: boolean, setReply: Response = Response.json('paid')) {
  localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({
    access_token: 'test', refresh_token: 'test', token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600,
    user: { id: '00000000-0000-4000-8000-000000000103', aud: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: '2026-10-18T00:00:00Z' },
  }));
  const sent: unknown[] = [];
  vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input instanceof Request ? input.url : input);
    if (url.includes('/rpc/member_search')) return Response.json([found('m1', 'Kabir Sethi', 1001), found('m2', 'Rohan Bhatia', 1042)]);
    if (url.includes('/rpc/set_member_referrer')) {
      sent.push(JSON.parse(String(init?.body)));
      return setReply;
    }
    return Response.json([]);
  });
  render(
    <RivrDataProvider client={createRivrClient({ url: 'http://127.0.0.1:9', publishableKey: 'test' })}
      queryClient={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemberReferrer venueId="v1" memberId="m1" signUp={signUp} canSet={canSet} />
    </RivrDataProvider>,
  );
  return sent;
}

/** Finds Rohan by what is typed and chooses him. */
async function chooseRohan() {
  fireEvent.click(screen.getByRole('button', { name: 'Add referrer' }));
  fireEvent.change(screen.getByRole('textbox', { name: 'Name, mobile or member number' }), { target: { value: 'Ro' } });
  fireEvent.click(await screen.findByRole('radio', { name: 'Rohan Bhatia · 1042' }));
}

describe('MemberReferrer (the owner, 25 Nov)', () => {
  it('finds the referrer by search, never the member themselves, and sets them on Yes, paid now for one who has sat', async () => {
    const sent = renderReferrer(SIGN_UP, true);
    expect(screen.getByText('None')).toBeDefined();
    await chooseRohan();
    expect(screen.queryByRole('radio', { name: /^Kabir Sethi/ })).toBeNull();
    expect(screen.getByText('Set Rohan Bhatia as the referrer? Both get the referral reward now.')).toBeDefined();
    // The search takes the focus as it opens; the opener stays, open, to close it again.
    expect(screen.getByRole('textbox', { name: 'Name, mobile or member number' })).toHaveProperty('ownerDocument.activeElement', screen.getByRole('textbox', { name: 'Name, mobile or member number' }));
    expect(screen.getByRole('button', { name: 'Add referrer' }).getAttribute('aria-expanded')).toBe('true');
    fireEvent.click(screen.getByRole('button', { name: 'Yes, set referrer' }));
    expect(await screen.findByText('Referrer set. Both got the referral reward.')).toBeDefined();
    expect(sent).toEqual([{ p_member_id: 'm1', p_referrer_id: 'm2' }]);
  });

  it('says the reward waits for the first seat for one who has not sat', async () => {
    renderReferrer({ ...SIGN_UP, hasSat: false }, true, Response.json('at_first_seat'));
    await chooseRohan();
    expect(screen.getByText('Set Rohan Bhatia as the referrer? Both get the referral reward at the first seat.')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Yes, set referrer' }));
    expect(await screen.findByText('Referrer set. Both get the referral reward at the first seat.')).toBeDefined();
  });

  it('says why a referrer is refused', async () => {
    renderReferrer(SIGN_UP, true, Response.json({ code: 'RVRFT', message: 'no referrals' }, { status: 400 }));
    await chooseRohan();
    fireEvent.click(screen.getByRole('button', { name: 'Yes, set referrer' }));
    expect(await screen.findByText('Their tier has no referrals.')).toBeDefined();
  });

  it('keeps a paid referral\'s referrer, and offers no change to staff who may not set one', async () => {
    const referrer = { memberId: 'm2', fullName: 'Rohan Bhatia', memberNumber: 1042 };
    renderReferrer({ ...SIGN_UP, referrer, referralCompletedAt: '2026-11-20T10:00:00Z' }, true);
    expect(screen.getByText(/^Rohan Bhatia · 1042 · paid /)).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Change referrer' })).toBeNull();
    cleanup();
    renderReferrer({ ...SIGN_UP, referrer }, false);
    expect(screen.getByText('Rohan Bhatia · 1042')).toBeDefined();
    await waitFor(() => expect(screen.queryByRole('button', { name: /referrer$/ })).toBeNull());
  });
});
