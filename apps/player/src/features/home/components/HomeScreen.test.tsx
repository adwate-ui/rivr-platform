import { cleanup, fireEvent, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FEATURES, LATER, NOW, PLACE, renderTonight, SEAT, TABLES, TYPES } from './homeTestKit.tsx';

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.unstubAllGlobals();
});

describe('Tonight', () => {
  it('Browsing: lists the tables by stakes with their minimum buy-in, a closed one dimmed, and opens the join sheet', async () => {
    renderTonight();
    const table = await screen.findByRole('button', { name: /Table 1 · NLH 50\/100/ }, LATER);
    // Stakes and buy-in only: players see neither seats nor the wait (owner, 8 Nov).
    expect(table.textContent).toBe('Table 1 · NLH 50/100Min buy-in ₹7,350');
    for (const closed of ['Table 4 · NLH 50/100', 'Closed', 'Opens later']) expect(screen.getByText(closed)).toBeDefined();
    fireEvent.click(table);
    const sheet = await screen.findByRole('dialog', { name: "No-Limit Hold'em 50/100" });
    expect(sheet.textContent).toContain('Table 1');
    expect(sheet.textContent).toContain('Min buy-in₹7,350');
    expect(sheet.textContent).not.toContain('₹5,000');
    expect(sheet.textContent).not.toMatch(/open|[Ww]ait|Full/);
    expect(screen.queryByRole('img', { name: /seats open/ })).toBeNull();
    expect(screen.getByRole('button', { name: 'Request a seat' })).toBeDefined();
  });

  it('Browsing: lists the open tables first, a closed one after; a straddle follows the blinds (owner, 3 and 8 Nov)', async () => {
    const t5 = { ...TABLES[0], id: 't5', name: 'Table 5', position: 3, table_type_id: 'tt2' };
    renderTonight([], [], {
      '/rest/v1/game_table': [TABLES[0], { ...TABLES[1], position: 2 }, t5],
      '/rest/v1/table_type': [...TYPES, { ...TYPES[0], id: 'tt2', small_blind_paise: 10_000, big_blind_paise: 20_000, straddle_paise: 40_000 }],
      '/rpc/waitlist_lengths': [{ table_id: 't1', waiting: 2, call_time_minutes: 180 }, { table_id: 't5', waiting: 0, call_time_minutes: 180 }],
    });
    await screen.findByText('Table 5 · NLH 100/200/400', {}, LATER);
    const rows = screen.getAllByText(/^Table \d · NLH [\d/]+$/).map((name) => name.textContent);
    expect(rows).toEqual(['Table 1 · NLH 50/100', 'Table 5 · NLH 100/200/400', 'Table 4 · NLH 50/100']);
    fireEvent.click(screen.getByRole('button', { name: /^Table 5 · NLH 100\/200\/400/ }));
    expect(await screen.findByRole('dialog', { name: "No-Limit Hold'em 100/200/400" })).toBeDefined();
  });

  it('Browsing: one referral reward makes one offer card, before the club\'s other promotions in the row (owner, 3 Nov)', async () => {
    renderTonight([], [], {
      '/rpc/my_feature_access': [...FEATURES, { feature_key: 'promotions.feed', state: 'enabled', tiers: null }],
      '/rpc/my_referral': [{ code: 'PGHG59H7', referred: 0, bonus_paise: 100000 }],
      // As the server lists them since 3 Nov: the promotion behind the referral card is not a card again.
      '/rpc/my_promotion_cards': [
        { promotion_id: 'p1', title: 'High hands', detail: 'Royal flush 25,000', runs: 'Every night', link: null },
        { promotion_id: 'p2', title: 'Buy-in bonus Tuesday', detail: '20% on the first five buy-ins per table', runs: 'Tuesday · all stakes',
          link: 'https://glaza.example/tuesday' },
      ],
    });
    const offers = await screen.findByRole('region', { name: 'Offers' }, LATER);
    await within(offers).findByText('Refer a friend', {}, LATER);
    expect(within(offers).getAllByText('Refer a friend')).toHaveLength(1);
    expect(within(offers).getByText('1,000 Bonus each')).toBeDefined();
    expect(within(offers).getAllByRole('listitem')).toHaveLength(3);
    // One carousel through all three, a dot each (redesign RD-20).
    expect(within(offers).getAllByRole('button', { name: /^Offer \d of 3$/ })).toHaveLength(3);
    // A card with a link opens it (issue 776); one without only says its offer.
    expect(within(offers).getByRole('link', { name: /Buy-in bonus Tuesday/ }).getAttribute('href')).toBe('https://glaza.example/tuesday');
    expect(within(offers).queryByRole('link', { name: /High hands/ })).toBeNull();
  });

  it('On the list: the place, Next in line, when they joined, and Leave waitlist', async () => {
    renderTonight([PLACE]);
    expect(await screen.findByText('Next in line', {}, LATER)).toBeDefined();
    expect(screen.getByText('Waitlist · Table 1 · NLH 50/100')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Leave waitlist' })).toBeDefined();
  });

  it('Seat ready: where, the hold counting down from the server\'s time, and the two answers', async () => {
    renderTonight([{ ...PLACE, call_table_name: 'Table 1', call_seat: 4, called_at: '2026-11-15T17:04:00Z', hold_until: '2026-11-15T17:24:00Z' }]);
    expect(await screen.findByText('Your seat is ready', {}, LATER)).toBeDefined();
    expect(screen.getByRole('heading', { name: 'Table 1, seat 4' })).toBeDefined();
    expect(screen.getByRole('timer', { name: 'Seat held for 10 min' }).textContent).toBe('10:00');
    expect(screen.getByRole('button', { name: "I'm on my way" })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Decline seat' })).toBeDefined();
  });

  it('Seated: the seat in the header, and when they sat down where the countdown was (the owner, 17 Nov)', async () => {
    renderTonight([], [SEAT]);
    expect(await screen.findByRole('heading', { name: 'Table 1, seat 4' }, LATER)).toBeDefined();
    expect(screen.getByText('NLH 50/100 · playing 19 min')).toBeDefined();
    expect(screen.getByText('Playing since')).toBeDefined();
    expect(screen.getByText('22:25')).toBeDefined();
    expect(screen.queryByRole('timer')).toBeNull();
    // Not until the member sets one themselves.
    expect(screen.queryByText(/^Call time until/)).toBeNull();
  });

  it('Seated with a call time they set: when it ends, under when they sat down', async () => {
    renderTonight([], [{ ...SEAT, call_time_set_at: '2026-11-15T17:10:00Z' }]);
    expect(await screen.findByText('Call time until 01:25', {}, LATER)).toBeDefined();
  });

  it('Seated with a call time they set that has run out: it is done, so no "until"', async () => {
    renderTonight([], [{ ...SEAT, call_time_set_at: '2026-11-15T14:00:00Z', call_time_left: 0, call_time_ends_at: new Date(NOW).toISOString() }]);
    expect(await screen.findByRole('heading', { name: 'Table 1, seat 4' }, LATER)).toBeDefined();
    expect(screen.getByText('Playing since')).toBeDefined();
    expect(screen.queryByText(/^Call time until/)).toBeNull();
  });

  // Issue 781: the floor can add a seated member to another list to change tables (#633).
  it('Seated: a place on a list to change tables shows under the seat, with where they stand', async () => {
    renderTonight([{ ...PLACE, place: 2, table_id: null, table_name: null }, { ...PLACE, entry_id: 'e2', place: null, is_request: true },
      { ...PLACE, entry_id: 'e3', table_name: 'Table 2', call_table_name: 'Table 2', call_seat: 3, hold_until: new Date(NOW + 600_000).toISOString() }], [SEAT]);
    expect(await screen.findByText('Waitlist · NLH 50/100', {}, LATER)).toBeDefined();
    expect(screen.getByText('2nd in line')).toBeDefined();
    expect(screen.getByText('Waitlist · Table 1 · NLH 50/100')).toBeDefined();
    expect(screen.getByText('Requested')).toBeDefined();
    // Called to the new table, the place says its seat is held.
    expect(screen.getByText('Waitlist · Table 2 · NLH 50/100')).toBeDefined();
    expect(screen.getByText('Your seat is ready')).toBeDefined();
    // Still the seat's screen, not the place's.
    expect(screen.getByRole('button', { name: 'Leave seat' })).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Leave waitlist' })).toBeNull();
  });

  it('A top-up asked for shows waiting and dims Top up; Set call time stays open', async () => {
    renderTonight([], [{ ...SEAT, top_up: 'requested' }]);
    expect(await screen.findByText('Top-up', {}, LATER)).toBeDefined();
    expect(screen.getByRole('button', { name: 'Set call time' }).getAttribute('aria-disabled')).not.toBe('true');
    expect(screen.getByRole('button', { name: 'Top up' }).getAttribute('aria-disabled')).toBe('true');
    fireEvent.click(screen.getByRole('button', { name: 'Leave seat' }));
    expect(await screen.findByRole('dialog', { name: 'Leave your seat?' })).toBeDefined();
    expect(screen.getByText('2 h 42 min call time left.')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Join leaving list' })).toBeDefined();
  });

  it('Leave with no call time set once the countdown is done says none was set', async () => {
    renderTonight([], [{ ...SEAT, call_time_left: 0, call_time_ends_at: null }]);
    fireEvent.click(await screen.findByRole('button', { name: 'Leave seat' }, LATER));
    const sheet = await screen.findByRole('dialog', { name: 'Leave your seat?' });
    expect(within(sheet).getByText('Call time not set.')).toBeDefined();
  });

  it('Leave says nothing of call time to a member who may not see it', async () => {
    renderTonight([], [{ ...SEAT, call_time_left: null, call_time_minutes: null, call_time_ends_at: null, call_time_choices_open: [] }]);
    fireEvent.click(await screen.findByRole('button', { name: 'Leave seat' }, LATER));
    const sheet = await screen.findByRole('dialog', { name: 'Leave your seat?' });
    expect(within(sheet).queryByText(/call time/i)).toBeNull();
    expect(within(sheet).getByRole('button', { name: 'Join leaving list' })).toBeDefined();
  });

  it('Set call time: lengths that would end before the call time owed are greyed, with why, and the first open one is set', async () => {
    // 2 h 41 min 8 s owed: an hour and two hours end before it, so the server opens three and four hours alone (#1076).
    const { asked } = renderTonight([], [{ ...SEAT, add_time_choices: [60, 120, 180, 240], call_time_choices_open: [180, 240] }]);
    fireEvent.click(await screen.findByRole('button', { name: 'Set call time' }, LATER));
    const sheet = await screen.findByRole('dialog', { name: 'Set call time' });
    expect(within(sheet).getByRole('radio', { name: '1 h' })).toHaveProperty('disabled', true);
    expect(within(sheet).getByRole('radio', { name: '2 h' })).toHaveProperty('disabled', true);
    expect(within(sheet).getByRole('radio', { name: '3 h' }).getAttribute('aria-checked')).toBe('true');
    expect(within(sheet).getByText('Until 01:44')).toBeDefined();
    expect(within(sheet).getByText("Can't end before 01:25.")).toBeDefined();
    // Setting is from now: no 'beyond the current end' (#1089).
    expect(within(sheet).queryByText('Extend adds time beyond the current end.')).toBeNull();
    fireEvent.click(within(sheet).getByRole('button', { name: 'Set call time' }));
    await vi.waitFor(() => expect(asked.filter((call) => call.startsWith('set_my_call_time')).map((call) => call.includes('"p_minutes":180'))).toEqual([true]));
  });

  it('Set call time once the call time is met: every length the club types is open, and the one chosen is set (decision 0305)', async () => {
    const choices = [20, 45, 50, 75, 90, 200, 300];
    const { asked } = renderTonight([], [{ ...SEAT, call_time_left: 0, call_time_ends_at: null, add_time_choices: choices, call_time_choices_open: choices }]);
    fireEvent.click(await screen.findByRole('button', { name: 'Set call time' }, LATER));
    const radios = await screen.findAllByRole('radio');
    expect(radios.map((choice) => choice.textContent)).toEqual(['20 min', '45 min', '50 min', '1 h 15 min', '1 h 30 min', '3 h 20 min', '5 h']);
    expect(radios.some((choice) => choice.hasAttribute('disabled'))).toBe(false);
    expect(screen.queryByText(/^Can't end before/)).toBeNull();
    fireEvent.click(screen.getByRole('radio', { name: '3 h 20 min' }));
    fireEvent.click(within(screen.getByRole('dialog', { name: 'Set call time' })).getByRole('button', { name: 'Set call time' }));
    await vi.waitFor(() => expect(asked.filter((call) => call.startsWith('set_my_call_time')).map((call) => call.includes('"p_minutes":200'))).toEqual([true]));
  });

  it('Extend call time once set: a length is added to when it ends, and sent as the member\'s own (the owner, 18 Nov)', async () => {
    // Set, and ending at 01:25 IST: an hour more ends at 02:25.
    // Two hours closed (past the day's most): once set, the sheet greys it and says why, not "Can't end before" (#1089, #1099).
    const { asked } = renderTonight([], [{ ...SEAT, call_time_set_at: '2026-11-15T17:00:00Z', call_time_choices_open: [30, 60] }]);
    fireEvent.click(await screen.findByRole('button', { name: 'Extend call time' }, LATER));
    const sheet = await screen.findByRole('dialog', { name: 'Extend call time' });
    expect(within(sheet).getByRole('radio', { name: '1 h' }).getAttribute('aria-checked')).toBe('true');
    expect(within(sheet).getByText('Until 02:25')).toBeDefined();
    // Extend adds beyond the current end, and the sheet says so (#1089, the owner, 19 Nov).
    expect(within(sheet).getByText('Extend adds time beyond the current end.')).toBeDefined();
    expect(within(sheet).getByText("Call time can't pass 24 hours.")).toBeDefined();
    expect(within(sheet).queryByText(/^Can't end before/)).toBeNull();
    fireEvent.click(within(sheet).getByRole('button', { name: 'Extend call time' }));
    await vi.waitFor(() => expect(asked.filter((call) => call.startsWith('set_my_call_time')).map((call) => call.includes('"p_minutes":60'))).toEqual([true]));
  });

  it('Order on its way: the tracker reads where the order is, from the bar\'s steps', async () => {
    renderTonight([], [SEAT], { '/rpc/my_fnb_orders': [{
      order_id: 'o1', kot_number: 7, created_at: '2026-11-15T17:00:00Z', accepted_at: '2026-11-15T17:02:00Z', on_way_at: '2026-11-15T17:10:00Z',
      delivered_at: null, cancelled_at: null, cancel_reason: null, lines: [{ item_id: 'i1', name: 'Club sandwich', kind: 'food', quantity: 1, note: null }, { item_id: 'i2', name: 'Beer', kind: 'bar', quantity: 2, note: null }],
    }] });
    expect(await screen.findByText('Club sandwich, 2 × Beer', {}, LATER)).toBeDefined();
    expect(screen.getByRole('list', { name: 'Order' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Order to my seat' })).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Order again' })).toBeNull();
  });

  it('Food and drink off (decision 0681): no Order to my seat and no Order again, but the order placed still shows', async () => {
    renderTonight([], [SEAT], { '/rpc/fnb_on': false, '/rpc/my_fnb_orders': [{
      order_id: 'o1', kot_number: 7, created_at: '2026-11-15T17:00:00Z', accepted_at: '2026-11-15T17:02:00Z', on_way_at: null, delivered_at: null,
      cancelled_at: '2026-11-15T17:05:00Z', cancel_reason: 'Out of milk', lines: [{ item_id: 'i1', name: 'Masala chai', kind: 'soft_drink', quantity: 1, note: null }],
    }] });
    expect(await screen.findByText('Cancelled: Out of milk', {}, LATER)).toBeDefined();
    await vi.waitFor(() => expect(screen.queryByRole('button', { name: 'Order to my seat' })).toBeNull());
    expect(screen.queryByRole('button', { name: 'Order again' })).toBeNull();
  });

  it('Call time ending push: its button opens Set call time, and the address is cleaned', async () => {
    const { router } = renderTonight([], [SEAT], {}, '/?sheet=add-time');
    expect(await screen.findByRole('dialog', { name: 'Set call time' }, LATER)).toBeDefined();
    expect(router.state.location.search).toEqual({});
  });

  it('Seat ready push: I\'m on my way tells the floor for the place it names, once', async () => {
    const called = { ...PLACE, call_table_name: 'Table 1', call_seat: 4, called_at: '2026-11-15T17:04:00Z', hold_until: '2026-11-15T17:24:00Z' };
    const { router, asked } = renderTonight([called], [], {}, '/?accept=e1');
    expect(await screen.findByText('Your seat is ready', {}, LATER)).toBeDefined();
    await vi.waitFor(() => expect(asked.filter((call) => call.startsWith('accept_seat_call'))).toEqual(['accept_seat_call {"p_entry_id":"e1"}']));
    expect(router.state.location.search).toEqual({});
  });

  it('Seat ready push for a call that is over: nothing is sent', async () => {
    const { router, asked } = renderTonight([], [SEAT], {}, '/?accept=e1');
    expect(await screen.findByRole('heading', { name: 'Table 1, seat 4' }, LATER)).toBeDefined();
    await vi.waitFor(() => expect(router.state.location.search).toEqual({}));
    expect(asked.filter((call) => call.startsWith('accept_seat_call'))).toEqual([]);
  });

  it('Order: an order staff voided says it was cancelled and why, with Order again (decision 0302)', async () => {
    renderTonight([], [SEAT], { '/rpc/my_fnb_orders': [{
      order_id: 'o1', kot_number: 7, created_at: '2026-11-15T17:00:00Z', accepted_at: '2026-11-15T17:02:00Z', on_way_at: null, delivered_at: null,
      cancelled_at: '2026-11-15T17:05:00Z', cancel_reason: 'Out of milk', lines: [{ item_id: 'i1', name: 'Masala chai', kind: 'soft_drink', quantity: 1, note: null }],
    }] });
    expect(await screen.findByText('Cancelled: Out of milk', {}, LATER)).toBeDefined();
    expect(screen.queryByRole('list', { name: 'Order' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Order again' })).toBeDefined();
  });

  it('Rate your visit: a visit with no table played says Tonight, with no time or table', async () => {
    renderTonight([], [], { '/rpc/my_feedback_visit': [{ visit_id: 'v1', closed_at: '2026-11-15T16:00:00Z', played_seconds: 0, table_name: null }] });
    expect(await screen.findByRole('heading', { name: 'How was your night?' }, LATER)).toBeDefined();
    expect(screen.getByText('Tonight', { selector: 'p' })).toBeDefined();
    expect(screen.queryByText(/ at $/)).toBeNull();
  });

  it('On a break (decision 0300): a banner says until when, and a table offers no join', async () => {
    renderTonight([], [], { '/rpc/my_restrictions': [{ break_until: '2026-11-20T12:00:00Z', session_reminder_hours: null }] });
    expect(await screen.findByText(/^On a break until /, {}, LATER)).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: /Table 1 · NLH 50\/100/ }));
    expect(await screen.findByRole('dialog', { name: "No-Limit Hold'em 50/100" })).toBeDefined();
    expect(screen.getAllByText(/^On a break until /)).toHaveLength(2);
    expect(screen.queryByRole('button', { name: /^Request a seat$/ })).toBeNull();
  });

  it('Browsing: the tournaments under the tables say Notify me, or Notifying you once asked', async () => {
    renderTonight([], [], {
      '/rpc/my_feature_access': [...FEATURES, { feature_key: 'tournaments.register', state: 'enabled', tiers: null }],
      '/rpc/my_upcoming_tournaments': [
        { tournament_id: 't1', name: 'Weeknight Turbo', starts_at: '2026-11-17T14:30:00Z', standing: 'none' },
        { tournament_id: 't2', name: 'Sunday Main Event', starts_at: '2026-11-22T08:30:00Z', standing: 'interested' },
      ],
    });
    expect((await screen.findByRole('button', { name: 'Notify me: Weeknight Turbo' }, LATER)).textContent).toBe('Notify me');
    expect(screen.getByRole('button', { name: 'Notifying you: Sunday Main Event' }).textContent).toBe('Notifying you');
  });

  it('Browsing: Notify me says why it did not go through', async () => {
    renderTonight([], [], {
      '/rpc/my_feature_access': [...FEATURES, { feature_key: 'tournaments.register', state: 'enabled', tiers: null }],
      '/rpc/my_upcoming_tournaments': [{ tournament_id: 't1', name: 'Weeknight Turbo', starts_at: '2026-11-17T14:30:00Z', standing: 'none' }],
      '/rpc/register_tournament_interest': Response.json({ code: 'RVFRZ', message: 'paused' }, { status: 400 }),
    });
    fireEvent.click(await screen.findByRole('button', { name: 'Notify me: Weeknight Turbo' }, LATER));
    expect(await screen.findByText('The club is paused. Try again later.')).toBeDefined();
  });
});
