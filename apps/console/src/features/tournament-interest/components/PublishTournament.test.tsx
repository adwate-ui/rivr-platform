import { createRivrClient, RivrDataProvider, SESSION_STORAGE_KEY } from '@rivr/db';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PublishTournament } from './PublishTournament.tsx';

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.unstubAllGlobals();
});

/** Aditya, who manages tournaments, signed in, and a fake API that answers publish_tournament with `reply`; the bodies it was sent. */
function renderForm(reply: () => Response) {
  localStorage.setItem(
    SESSION_STORAGE_KEY,
    JSON.stringify({
      access_token: 'test', refresh_token: 'test', token_type: 'bearer', expires_in: 3600,
      expires_at: Math.floor(Date.now() / 1000) + 3600,
      user: { id: '00000000-0000-4000-8000-000000000103', aud: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: '2026-10-18T00:00:00Z' },
    }),
  );
  const sent: unknown[] = [];
  vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input instanceof Request ? input.url : input);
    if (url.includes('/rpc/publish_tournament')) {
      sent.push(JSON.parse(String(init?.body)));
      return reply();
    }
    return Response.json([]);
  });
  const client = createRivrClient({ url: 'http://127.0.0.1:9', publishableKey: 'test' });
  render(<RivrDataProvider client={client}><PublishTournament venueId="v1" /></RivrDataProvider>);
  return sent;
}

/** Fills the form as staff would. */
function fill(values: Record<string, string>) {
  for (const [label, value] of Object.entries(values)) fireEvent.change(screen.getByLabelText(label), { target: { value } });
}

const DEEPSTACK = {
  Name: 'Diwali Deepstack', Day: '2026-11-15', 'Start time': '16:00', Game: 'No-limit hold’em', Stake: '25,000 chips',
  Description: 'Twenty-minute levels.',
};

describe('A tournament published without money', () => {
  it('publishes the name, start, game, stake and description, with nowhere to put a buy-in or prize', async () => {
    const sent = renderForm(() => Response.json('t1'));
    expect(screen.queryByLabelText(/buy-in|prize|guarantee/i)).toBeNull();
    fill(DEEPSTACK);
    fireEvent.click(screen.getByRole('button', { name: 'Publish' }));
    expect(await screen.findByText('Diwali Deepstack published.')).toBeDefined();
    expect(sent).toEqual([{
      p_venue_id: 'v1', p_name: 'Diwali Deepstack', p_starts_at: '2026-11-15T10:30:00.000Z', p_game: 'No-limit hold’em',
      p_stake: '25,000 chips', p_description: 'Twenty-minute levels.',
    }]);
    expect(screen.getByLabelText('Name')).toHaveProperty('value', '');
  });

  it('says what is missing, and publishes nothing', async () => {
    const sent = renderForm(() => Response.json('t1'));
    fireEvent.click(screen.getByRole('button', { name: 'Publish' }));
    expect(await screen.findByText('Give it a name of up to 80 characters.')).toBeDefined();
    expect(screen.getByText('Give the game, up to 40 characters.')).toBeDefined();
    expect(screen.getByText('Give the stake, up to 40 characters.')).toBeDefined();
    expect(sent).toEqual([]);
  });

  it('says why the club did not publish it', async () => {
    renderForm(() => Response.json({ code: '22023', message: 'A start to come' }, { status: 400 }));
    fill(DEEPSTACK);
    fireEvent.click(screen.getByRole('button', { name: 'Publish' }));
    expect(await screen.findByText('Not published. Choose a start still to come.')).toBeDefined();
  });
});
