import { fromPaise } from '@rivr/domain/money';
import { createClient } from '@supabase/supabase-js';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import type { RivrClient } from './client.ts';
import type { Database } from './database.types.ts';
import { RivrDataProvider } from './provider.tsx';
import { useSettingActions, useVenueSettings } from './settings.ts';
import { sessionStorageFor, TEST_SESSION_KEY } from './test/session.ts';
import { useChipDenominations, useVenueConfig, useVenueConfigActions } from './venueConfig.ts';

const SUPER_ADMIN = '00000000-0000-4000-8000-000000000101';
const VENUE = '00000000-0000-4000-8000-000000000001';
const HOUR = 3_600_000;
const inHours = (hours: number) => new Date(Date.now() + hours * HOUR).toISOString();

/** A fake API: each method and table, as `GET /setting`, answers with its reply; returns the requests made. */
function renderSettings(replies: Record<string, { status?: number; body: unknown }>) {
  const calls: { method: string; path: string; body: unknown }[] = [];
  const fetch: typeof globalThis.fetch = async (input, init) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    const method = init?.method ?? 'GET';
    const path = url.pathname.replace('/rest/v1', '');
    calls.push({ method, path, body: init?.body ? JSON.parse(String(init.body)) : undefined });
    const reply = replies[`${method} ${path}`];
    return Response.json(reply?.body ?? null, { status: reply?.status ?? 200 });
  };
  const client: RivrClient = createClient<Database>('http://127.0.0.1:9', 'test-publishable-key', {
    global: { fetch },
    auth: { storage: sessionStorageFor(SUPER_ADMIN), storageKey: TEST_SESSION_KEY, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const wrapper = ({ children }: { children: ReactNode }) => <RivrDataProvider client={client}>{children}</RivrDataProvider>;
  const { result } = renderHook(() => ({
    settings: useVenueSettings(VENUE), actions: useSettingActions(VENUE),
    config: useVenueConfig(VENUE), chips: useChipDenominations(VENUE), configActions: useVenueConfigActions(VENUE),
  }), { wrapper });
  return { result, calls };
}

const KEYS = [
  {
    key: 'call_time.minutes', description: 'Call time', scope: 'table_type',
    value_schema: { type: 'object', properties: { minutes: { type: 'integer', minimum: 0, maximum: 1440 } } },
  },
  {
    key: 'tds.config', description: 'TDS', scope: 'venue',
    value_schema: { type: 'object', properties: { enabled: { type: 'boolean' }, basis: { type: 'string', enum: ['session', 'day'] }, section: { type: 'string' } } },
  },
  { key: 'tier.default', description: 'Default tier', scope: 'venue', value_schema: { type: 'object', properties: { tier_id: { type: 'string', format: 'uuid' } } } },
];
const ROWS = [
  { id: 'c3', key: 'call_time.minutes', subject: 'nlh_100_200', value: { minutes: 60 }, effective_from: inHours(5), reason: 'Later' },
  { id: 'c1', key: 'call_time.minutes', subject: 'nlh_100_200', value: { minutes: 30 }, effective_from: '-infinity', reason: 'Seed' },
  { id: 'c2', key: 'call_time.minutes', subject: 'nlh_100_200', value: { minutes: 45 }, effective_from: inHours(-2), reason: 'Tonight' },
  { id: 'c9', key: 'call_time.minutes', subject: 'old_table', value: { minutes: 20 }, effective_from: '-infinity', reason: 'Seed' },
];
const READS = {
  'GET /setting_key': { body: KEYS },
  'GET /setting': { body: ROWS },
  'GET /table_type': { body: [{ code: 'nlh_100_200', name: 'NLH 100/200' }, { code: 'private_room', name: 'Private Room' }] },
  'GET /tier': { body: [{ id: 'tier-1', name: 'Member' }] },
};

afterEach(cleanup);

async function outcomeOf(run: () => Promise<unknown>) {
  let outcome: unknown;
  await act(async () => { outcome = await run(); });
  return outcome;
}

describe('settings (#33)', () => {
  it('gives every key from the database with its fields from its schema, and the venue\'s tiers', async () => {
    const { result } = renderSettings(READS);
    await waitFor(() => expect(result.current.settings.data?.settings).toHaveLength(3));
    expect(result.current.settings.data?.settings.map((setting) => setting.fields)).toEqual([
      [{ kind: 'integer', name: 'minutes', min: 0, max: 1440, isMoney: false }],
      [{ kind: 'boolean', name: 'enabled' }, { kind: 'choice', name: 'basis', options: ['session', 'day'] }, { kind: 'text', name: 'section' }],
      [{ kind: 'tier', name: 'tier_id' }],
    ]);
    expect(result.current.settings.data?.tiers).toEqual([{ subject: 'tier-1', label: 'Member' }]);
  });

  it('gives each subject its value now, its changes to come and its values before, a removed table type included', async () => {
    const { result } = renderSettings(READS);
    await waitFor(() => expect(result.current.settings.data?.settings).toHaveLength(3));
    const [callTime, tds] = result.current.settings.data?.settings ?? [];
    expect(callTime?.subjects.map((subject) => [subject.subject, subject.label])).toEqual([
      ['nlh_100_200', 'NLH 100/200'], ['private_room', 'Private Room'], ['old_table', 'old_table'],
    ]);
    expect(callTime?.subjects[0]).toMatchObject({
      inForce: { settingId: 'c2' }, scheduled: [{ settingId: 'c3' }],
      history: [{ settingId: 'c1', value: { minutes: 30 }, effectiveFrom: null, reason: 'Seed' }],
    });
    expect(tds?.subjects).toEqual([{ subject: '', label: '', inForce: null, scheduled: [], history: [] }]);
  });

  it('schedules a value from now by the database\'s clock, sending no time, and says when a money key is too soon', async () => {
    const { result, calls } = renderSettings({ ...READS, 'POST /setting': { status: 400, body: { code: 'RVMIN', message: 'soon' } } });
    const change = { key: 'call_time.minutes', subject: 'nlh_100_200', value: { minutes: 50 }, effectiveFrom: null, reason: 'Busy' };
    expect(await outcomeOf(() => result.current.actions.schedule.mutateAsync(change))).toEqual({ ok: false, error: 'too_soon' });
    expect(calls.find((call) => call.method === 'POST')?.body).toEqual({
      venue_id: VENUE, key: 'call_time.minutes', subject: 'nlh_100_200', value: { minutes: 50 }, reason: 'Busy',
    });
  });

  it('schedules a value from a later moment as given', async () => {
    const { result, calls } = renderSettings({ ...READS, 'POST /setting': { status: 201, body: null } });
    const effectiveFrom = inHours(24);
    const change = { key: 'tds.config', subject: '', value: { enabled: true }, effectiveFrom, reason: 'Ruling' };
    expect(await outcomeOf(() => result.current.actions.schedule.mutateAsync(change))).toEqual({ ok: true, value: null });
    expect(calls.find((call) => call.method === 'POST')?.body).toMatchObject({ effective_from: effectiveFrom });
  });

  it('reads a refusal by its code: not allowed, a value the schema refuses, a moment already taken', async () => {
    for (const [code, failure] of [['42501', 'not_allowed'], ['23514', 'invalid'], ['23505', 'taken'], ['XX000', 'unavailable']] as const) {
      const { result } = renderSettings({ ...READS, 'POST /setting': { status: 400, body: { code, message: 'no' } } });
      const change = { key: 'tds.config', subject: '', value: { enabled: true }, effectiveFrom: inHours(24), reason: 'Ruling' };
      expect(await outcomeOf(() => result.current.actions.schedule.mutateAsync(change))).toEqual({ ok: false, error: failure });
      cleanup();
    }
  });

  it('withdraws a change to come, counts one already withdrawn as done, and says why one stays', async () => {
    const withdrawn = renderSettings({ ...READS, 'DELETE /setting': { body: [{ id: 'c3' }] } });
    expect(await outcomeOf(() => withdrawn.result.current.actions.withdraw.mutateAsync('c3'))).toEqual({ ok: true, value: null });
    cleanup();
    const gone = renderSettings({ 'DELETE /setting': { body: [] }, 'GET /setting': { body: null } });
    expect(await outcomeOf(() => gone.result.current.actions.withdraw.mutateAsync('c3'))).toEqual({ ok: true, value: null });
    cleanup();
    const inForce = renderSettings({ 'DELETE /setting': { body: [] }, 'GET /setting': { body: { effective_from: inHours(-2) } } });
    expect(await outcomeOf(() => inForce.result.current.actions.withdraw.mutateAsync('c2'))).toEqual({ ok: false, error: 'in_force' });
    cleanup();
    const moneySoon = renderSettings({ 'DELETE /setting': { body: [] }, 'GET /setting': { body: { effective_from: new Date(Date.now() + 30_000).toISOString() } } });
    expect(await outcomeOf(() => moneySoon.result.current.actions.withdraw.mutateAsync('r1'))).toEqual({ ok: false, error: 'too_soon' });
  });
});

describe('venue configuration and chips (#33)', () => {
  const DETAIL = {
    venue_id: VENUE, legal_name: 'RIVR Gaming Pvt Ltd', gstin: null, tan: 'DELR12345E', address: 'Gurugram', upi_payee_name: null, upi_vpa: null, bank_name: null,
    bank_account_name: null, bank_account_number: null, bank_ifsc: null, invoice_prefix: 'RIVR', staff_ip_allowlist: ['203.0.113.0/24'],
    alert_whatsapp: '+919876543210', logo_path: null, created_at: '', updated_at: '',
  };

  it('reads the configuration for a super admin, and nothing for anyone else', async () => {
    const { result } = renderSettings({ 'GET /venue_config_detail': { body: DETAIL } });
    await waitFor(() => expect(result.current.config.data).toMatchObject({ legalName: 'RIVR Gaming Pvt Ltd', tan: 'DELR12345E', staffIpAllowlist: ['203.0.113.0/24'] }));
    cleanup();
    const other = renderSettings({ 'GET /venue_config_detail': { body: null } });
    await waitFor(() => expect(other.result.current.config.data).toBeNull());
  });

  it('saves the configuration, and reads a change RLS hid as not allowed', async () => {
    const change = {
      legalName: 'RIVR', gstin: null, tan: null, address: 'Gurugram', upiPayeeName: null, upiVpa: null, bankName: null, bankAccountName: null,
      bankAccountNumber: null, bankIfsc: null, invoicePrefix: 'RIVR', staffIpAllowlist: ['203.0.113.7'], alertWhatsapp: null,
    };
    const saved = renderSettings({ 'PATCH /venue_config': { body: [{ venue_id: VENUE }] } });
    expect(await outcomeOf(() => saved.result.current.configActions.save.mutateAsync(change))).toEqual({ ok: true, value: null });
    expect(saved.calls.find((call) => call.method === 'PATCH')?.body).toMatchObject({ legal_name: 'RIVR', tan: null, staff_ip_allowlist: ['203.0.113.7'] });
    cleanup();
    const hidden = renderSettings({ 'PATCH /venue_config': { body: [] } });
    expect(await outcomeOf(() => hidden.result.current.configActions.save.mutateAsync(change))).toEqual({ ok: false, error: 'not_allowed' });
  });

  it('lists the chips, adds one in paise, and says when one of that value is listed', async () => {
    const { result, calls } = renderSettings({
      'GET /chip_denomination': { body: [{ id: 'k1', value_paise: 5000, name: '₹50', is_active: true }] },
      'POST /chip_denomination': { status: 409, body: { code: '23505', message: 'dup' } },
    });
    await waitFor(() => expect(result.current.chips.data).toEqual([{ chipId: 'k1', value: 5000n, name: '₹50', isActive: true }]));
    expect(await outcomeOf(() => result.current.configActions.addChip.mutateAsync({ value: fromPaise(5000n), name: '₹50' }))).toEqual({ ok: false, error: 'taken' });
    expect(calls.find((call) => call.method === 'POST')?.body).toEqual({ venue_id: VENUE, value_paise: 5000, name: '₹50' });
  });
});
