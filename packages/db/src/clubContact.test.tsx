import { createClient } from '@supabase/supabase-js';
import { cleanup, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import type { RivrClient } from './client.ts';
import { fetchClubContact, useClubContact } from './clubContact.ts';
import type { Database } from './database.types.ts';
import { RivrDataProvider } from './provider.tsx';

afterEach(cleanup);

/** A client whose API answers public_club_contact with `rows`, or fails. */
function clientWith(rows: unknown[] | 'fails'): RivrClient {
  const fetch: typeof globalThis.fetch = async () => (rows === 'fails'
    ? Response.json({ code: 'PGRST000', message: 'down' }, { status: 503 }) : Response.json(rows));
  return createClient<Database>('http://127.0.0.1:9', 'test-publishable-key', { global: { fetch }, auth: { persistSession: false, autoRefreshToken: false } });
}

describe('the club contact (decision 0582)', () => {
  it('reads the club’s numbers for the website, none when it has set none, and says when they cannot be read', async () => {
    expect(await fetchClubContact(clientWith([{ phone: '+911244000000', whatsapp: '+919811100022' }])))
      .toEqual({ ok: true, value: { phone: '+911244000000', whatsapp: '+919811100022' } });
    expect(await fetchClubContact(clientWith([]))).toEqual({ ok: true, value: { phone: null, whatsapp: null } });
    expect(await fetchClubContact(clientWith('fails'))).toEqual({ ok: false, error: 'unavailable' });
  });

  it('gives the app the club’s numbers, signed in or not', async () => {
    const client = clientWith([{ phone: '+918796580435', whatsapp: null }]);
    const wrapper = ({ children }: { children: ReactNode }) => <RivrDataProvider client={client}>{children}</RivrDataProvider>;
    const { result } = renderHook(() => useClubContact(), { wrapper });
    await waitFor(() => expect(result.current.data).toEqual({ phone: '+918796580435', whatsapp: null }));
  });
});
