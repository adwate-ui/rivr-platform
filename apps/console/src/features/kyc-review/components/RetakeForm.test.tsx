import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { chooseNaina, NAINA, renderSection, stubCamera, takeAndUse } from './inPersonTestApi.tsx';

beforeEach(stubCamera);

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const retaken = () => Response.json({ status: 'retaken' });
const sentBack = { ...NAINA, status: 'verified', retake_kinds: ['pan'], retake_reasons: ['Blurred'] };
// As the database lists two: by the kind's name, the Aadhaar front before the PAN card.
const bothSentBack = { ...sentBack, retake_kinds: ['aadhaar_front', 'pan'], retake_reasons: ['Digits showing', 'Blurred'] };
const hasFocus = async (name: string) => waitFor(() => expect(document.activeElement).toBe(screen.getByRole('heading', { name, level: 3 })));

describe('a check where only photos were sent back (decision 0573, redesign RD-21)', () => {
  it('opens on the first of them, its camera ready and why above it, and sends that photo alone', async () => {
    const sent = renderSection(retaken, sentBack);
    fireEvent.change(screen.getByRole('searchbox', { name: 'Member\'s name or the last digits of their number' }), { target: { value: 'nai' } });
    expect(await screen.findByText('A photo was sent back. Take it again.')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Check Naina Kapoor' }));
    expect(await screen.findByText('Step 3 of 5: PAN card')).toBeDefined();
    await hasFocus('PAN card');
    expect(screen.getByText('Sent back: Blurred.')).toBeDefined();
    expect(screen.queryByLabelText('Date of birth on Naina Kapoor\'s original document')).toBeNull();
    await takeAndUse();
    expect(await screen.findByText('New photo kept for Naina Kapoor.')).toBeDefined();
    expect(sent).toEqual([{ memberId: NAINA.member_id, kind: 'pan', coversConfirmed: false, image: btoa('jpeg') }]);
  });

  it('with both sent back, opens on the PAN card, the earlier step, then moves on to the Aadhaar front, each with its own reason', async () => {
    const sent = renderSection(retaken, bothSentBack);
    await chooseNaina();
    expect(await screen.findByText('Step 3 of 5: PAN card')).toBeDefined();
    expect(screen.getByText('Photo 1 of 2')).toBeDefined();
    expect(screen.getByText('Sent back: Blurred.')).toBeDefined();
    await takeAndUse();
    expect(await screen.findByText('Step 4 of 5: Aadhaar front')).toBeDefined();
    await hasFocus('Aadhaar front');
    expect(screen.getByText('Photo 2 of 2')).toBeDefined();
    expect(screen.getByText('Sent back: Digits showing.')).toBeDefined();
    await takeAndUse(true);
    expect(await screen.findByText('New photo kept for Naina Kapoor.')).toBeDefined();
    expect(sent).toEqual([expect.objectContaining({ kind: 'pan', coversConfirmed: false }), expect.objectContaining({ kind: 'aadhaar_front', coversConfirmed: true })]);
  });

  it('keeps the bar while a photo is saved', async () => {
    let answer: (response: Response) => void = () => undefined;
    renderSection(() => new Promise<Response>((resolve) => { answer = resolve; }), sentBack);
    await chooseNaina();
    await takeAndUse();
    expect(await screen.findByText('Loading')).toBeDefined();
    expect(screen.getByText('Step 3 of 5: PAN card')).toBeDefined();
    answer(retaken());
    expect(await screen.findByText('New photo kept for Naina Kapoor.')).toBeDefined();
  });

  it('keeps a sent-back photo owed, and says why, when it was not saved', async () => {
    renderSection(() => Response.json({ error: 'decided' }, { status: 409 }), sentBack);
    await chooseNaina();
    await takeAndUse();
    expect((await screen.findByRole('alert')).textContent).toMatch(/^Already decided/);
    expect(screen.getByRole('button', { name: 'Photograph the PAN card' })).toBeDefined();
    expect(screen.getByText('Step 3 of 5: PAN card')).toBeDefined();
  });

  it('shows what is owed, in the steps\' order, when its camera is left with Back; Cancel goes back to the search', async () => {
    renderSection(retaken, bothSentBack);
    await chooseNaina();
    fireEvent.click(await screen.findByRole('button', { name: 'Back' }));
    await hasFocus('PAN card');
    expect(screen.getAllByRole('button', { name: /^Photograph the / }).map((button) => button.getAttribute('aria-label'))).toEqual(['Photograph the PAN card', 'Photograph the Aadhaar front']);
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.getByRole('searchbox', { name: 'Member\'s name or the last digits of their number' })).toBeDefined();
  });
});
