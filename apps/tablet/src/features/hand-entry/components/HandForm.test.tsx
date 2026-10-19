import { createRivrClient, RivrDataProvider, type TableRules } from '@rivr/db';
import { fromPaise } from '@rivr/domain/money';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { HandForm } from './HandForm.tsx';

const RULES: TableRules = {
  rake: { rateBasisPoints: 500n, cap: fromPaise(600000n), isJackpotLive: true, drop: fromPaise(10000n), dropAbove: fromPaise(500000n) },
  hasVariation: true,
};

const LOST = 'The hand was not logged. Check the connection and press Log hand again.';

/** What log_hand is sent. */
const sentHandSchema = z.object({ p_pot: z.number(), p_variant: z.string(), p_played_at: z.string(), p_idempotency_key: z.string() });
type SentHand = z.infer<typeof sentHandSchema>;

/**
 * The form on a fake API. log_hand answers from `answers` in turn: a hand's id, `lost` (the
 * connection drops, so the tablet cannot tell whether it was logged) or `frozen`. Returns what was
 * sent; `claims` gets what claim_high_hand was sent, which answers with a claim's id.
 */
function renderForm(answers: string[], claims: unknown[] = []) {
  const sent: SentHand[] = [];
  vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = input instanceof Request ? input.url : String(input);
    if (url.includes('/rpc/claim_high_hand')) {
      claims.push(JSON.parse(String(init?.body)));
      return Response.json('claim-1');
    }
    if (!url.includes('/rpc/log_hand')) return Response.json(null);
    sent.push(sentHandSchema.parse(JSON.parse(String(init?.body))));
    const answer = answers.shift();
    if (answer === 'lost') throw new TypeError('Failed to fetch');
    if (answer === 'frozen') return Response.json({ code: 'RVFRZ', message: 'frozen' }, { status: 400 });
    return Response.json(answer);
  });
  const client = createRivrClient({ url: 'http://127.0.0.1:9', publishableKey: 'test' });
  render(<RivrDataProvider client={client}><HandForm rules={RULES} /></RivrDataProvider>);
  return sent;
}

function press(...keys: string[]) {
  for (const key of keys) fireEvent.click(screen.getByRole('button', { name: key }));
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('logging a hand on the tablet', () => {
  it('shows the take as the pot is typed, and refuses a pot that is not whole chips', async () => {
    const sent = renderForm([]);
    press('1', '4', '0', '0', '1', '0');
    expect(screen.getByText('₹1,40,010')).toBeDefined();
    expect(screen.getByText('Capped at ₹6,000')).toBeDefined();
    press('Log hand');
    expect(await screen.findByText('A pot is whole ₹50 chips, up to ₹1 crore. ₹1,40,010 is not.')).toBeDefined();
    expect(sent).toEqual([]);
  });

  it('sends the same request again after a lost answer, however the keys were pressed, so the hand is logged once', async () => {
    const sent = renderForm(['lost', 'hand-1', 'hand-2']);
    press('4', '8', '000', 'Log hand');
    expect(await screen.findByText(LOST)).toBeDefined();
    // Taps that leave the pot and the game as they were.
    press('Hold\'em', 'Delete', '0', 'Log hand');
    await waitFor(() => expect(screen.queryByText(LOST)).toBeNull());
    expect(sent).toHaveLength(2);
    expect(sent[1]).toEqual(sent[0]);
    expect(sent[0]).toMatchObject({ p_pot: 4800000, p_variant: 'holdem' });
    press('4', '8', '000', 'Log hand');
    await waitFor(() => expect(sent).toHaveLength(3));
    expect(sent[2]?.p_idempotency_key).not.toBe(sent[0]?.p_idempotency_key);
  });

  it('sends a new request for another pot after a lost answer, and after a refusal', async () => {
    const sent = renderForm(['lost', 'frozen', 'hand-1']);
    press('4', '8', '000', 'Log hand');
    expect(await screen.findByText(LOST)).toBeDefined();
    press('Delete', 'Delete', '5', '0', 'Log hand');
    expect(await screen.findByText('The venue is frozen. Hands are logged again once it is released.')).toBeDefined();
    press('Log hand');
    await waitFor(() => expect(sent).toHaveLength(3));
    expect(sent[1]?.p_pot).toBe(4805000);
    expect(new Set(sent.map((hand) => hand.p_idempotency_key)).size).toBe(3);
  });

  it('flow 6: logs the hand and sends its high-hand claim to the floor with it', async () => {
    const claims: unknown[] = [];
    const sent = renderForm(['hand-1'], claims);
    // The pot first: once the claim is open, the seats share the keypad's names.
    press('2', '0', '000');
    fireEvent.click(screen.getByRole('switch', { name: 'High hand' }));
    fireEvent.click(within(screen.getByRole('group', { name: 'Type of hand' })).getByRole('button', { name: 'Straight flush' }));
    fireEvent.click(within(screen.getByRole('group', { name: 'Seat' })).getByRole('button', { name: '4' }));
    press('Log hand');
    expect(await screen.findByText('High hand sent to the floor.')).toBeDefined();
    expect(sent).toHaveLength(1);
    expect(claims).toEqual([{ p_hand_id: 'hand-1', p_seat: 4, p_category: 'straight_flush', p_rank: '' }]);
    expect(screen.getByRole('switch', { name: 'High hand' }).getAttribute('aria-checked')).toBe('false');
  });

  it('logs nothing until the claim is complete: a four of a kind needs its rank', async () => {
    const claims: unknown[] = [];
    const sent = renderForm(['hand-1'], claims);
    press('2', '0', '000');
    fireEvent.click(screen.getByRole('switch', { name: 'High hand' }));
    press('Log hand');
    expect(await screen.findByText('Pick the type of hand and the seat.')).toBeDefined();
    fireEvent.click(within(screen.getByRole('group', { name: 'Type of hand' })).getByRole('button', { name: 'Four of a kind' }));
    fireEvent.click(within(screen.getByRole('group', { name: 'Seat' })).getByRole('button', { name: '2' }));
    press('Log hand');
    expect(await screen.findByText('Pick the rank of the four of a kind.')).toBeDefined();
    expect(sent).toEqual([]);
    fireEvent.click(within(screen.getByRole('group', { name: 'Rank' })).getByRole('button', { name: 'Queens' }));
    press('Log hand');
    await waitFor(() => expect(claims).toEqual([{ p_hand_id: 'hand-1', p_seat: 2, p_category: 'four_of_a_kind', p_rank: 'Q' }]));
  });

  it('keeps the chosen game when it is pressed again, and shows the next hand as Hold\'em once one is logged', async () => {
    const sent = renderForm(['hand-1']);
    press('PLO', 'PLO', '4', '8', '000', 'Log hand');
    await waitFor(() => expect(sent).toHaveLength(1));
    expect(sent[0]?.p_variant).toBe('plo');
    await waitFor(() => expect(screen.getByRole('button', { name: 'Hold\'em' }).getAttribute('aria-pressed')).toBe('true'));
    expect(screen.getByRole('button', { name: 'PLO' }).getAttribute('aria-pressed')).toBe('false');
  });
});
