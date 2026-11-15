import { createRivrClient, RivrDataProvider, SESSION_STORAGE_KEY } from '@rivr/db';
import { QueryClient } from '@tanstack/react-query';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { vi } from 'vitest';
import { RulesArea } from './RulesArea.tsx';

const VENUE = '00000000-0000-4000-8000-000000000001';

const minutes = (minimum: number, maximum: number) => ({ type: 'object', properties: { minutes: { type: 'integer', minimum, maximum } }, required: ['minutes'] });

/** The setting keys the tests' database declares: some of each tab, one with no group, call time for each stake and a typed list. */
export const KEYS = [
  { key: 'waitlist.hold_minutes', description: 'Seat hold', scope: 'venue', value_schema: minutes(1, 120) },
  { key: 'bonus.daily_staff_cap', description: 'Daily cap', scope: 'venue',
    value_schema: { type: 'object', properties: { chips: { type: 'integer', minimum: 50, maximum: 1000000 } }, required: ['chips'] } },
  { key: 'dealer.rotation_minutes', description: 'Dealer rotation', scope: 'venue', value_schema: minutes(10, 120) },
  { key: 'kyc.at_the_club', description: 'Identity checked at the club', scope: 'venue',
    value_schema: { type: 'object', properties: { enabled: { type: 'boolean' } }, required: ['enabled'] } },
];
export const TIME_KEYS = [
  { key: 'call_time.minutes', description: 'Call time', scope: 'table_type', value_schema: minutes(0, 1440) },
  { key: 'call_time.add_choices', description: 'Add time choices', scope: 'venue',
    value_schema: { type: 'object', properties: { minutes: { type: 'array', minItems: 1, maxItems: 12, items: { type: 'integer', minimum: 1, maximum: 1440 } } }, required: ['minutes'] } },
];
export const STAKES = [{ code: 'nlh-50-100', name: 'NLH 50/100' }, { code: 'nlh-100-200', name: 'NLH 100/200' }];

/** Two days on, so it is a day to come wherever the test runs. */
export const A_DAY_TO_COME = new Date(Date.now() + 2 * 86_400_000).toISOString().slice(0, 10);

/** A value in force since the start of the year. */
export const inForce = (key: string, subject: string, value: unknown) => ({ id: `${key}:${subject}`, key, subject, value, effective_from: '2026-01-01T00:00:00+00:00', reason: 'Opening', creator: null });

interface Api {
  isSuperAdmin?: boolean;
  /** The values set, as the database's rows. */
  rows?: readonly unknown[];
  /** The setting keys; left out, KEYS. */
  keys?: () => Response;
  /** What the database says to a setting written; left out, it is kept. */
  reply?: () => Response;
}

/** What the fake API reads back: the keys, the stakes, the values set; nothing else. */
function readOf(url: string, api: Api): Response {
  if (url.includes('/rest/v1/setting_key')) return api.keys?.() ?? Response.json(KEYS);
  if (url.includes('/rest/v1/table_type')) return Response.json(STAKES);
  return Response.json(url.includes('/rest/v1/setting?') ? (api.rows ?? []) : []);
}

/** An admin (or a super admin) on one of Settings' tabs, over a fake API; every setting it is sent is in `written`. */
export function renderArea(area: 'floor' | 'members', api: Api = {}) {
  localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({
    access_token: 'test', refresh_token: 'test', token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600,
    user: { id: '00000000-0000-4000-8000-000000000103', aud: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: '2026-10-18T00:00:00Z' },
  }));
  const written: unknown[] = [];
  vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input instanceof Request ? input.url : input);
    if (init?.method !== 'POST' || !url.endsWith('/rest/v1/setting')) return readOf(url, api);
    written.push(JSON.parse(String(init.body)));
    return api.reply?.() ?? new Response(null, { status: 201 });
  });
  render(
    <RivrDataProvider client={createRivrClient({ url: 'http://127.0.0.1:9', publishableKey: 'test' })}
      queryClient={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <RulesArea venueId={VENUE} area={area} isSuperAdmin={api.isSuperAdmin ?? false} />
    </RivrDataProvider>,
  );
  return { written };
}

/** Opens a setting's panel from its row's action, Change unless told History, and gives the panel. */
export async function openPanel(name: string, action: 'Change' | 'History of' = 'Change') {
  fireEvent.click(await screen.findByRole('button', { name: `${action} ${name}` }, { timeout: 5000 }));
  return within(await screen.findByRole('dialog', { name }));
}

/** Gives the reason and presses Save. */
export function save(panel: ReturnType<typeof within>) {
  fireEvent.change(panel.getByRole('textbox', { name: /^Reason/ }), { target: { value: 'Busier nights' } });
  fireEvent.click(panel.getByRole('button', { name: 'Save change' }));
}
