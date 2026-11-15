import { cleanup, fireEvent, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { chooseNaina, NAINA, renderSection, stubCamera, takeAndUse, takeThreePhotos } from './inPersonTestApi.tsx';

beforeEach(stubCamera);

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const verified = () => Response.json({ status: 'verified' });

describe('the check in person as five steps (redesign RD-21)', () => {
  it('goes Member, Face, PAN card, Aadhaar front, Details under the progress bar, "Use photo" moving on each time', async () => {
    renderSection(verified);
    await chooseNaina();
    expect(await screen.findByText('Step 1 of 5: Member')).toBeDefined();
    expect(screen.getByRole('list', { name: 'ID check in person' })).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Start the check' }));
    expect(await screen.findByText('Step 2 of 5: Face')).toBeDefined();
    await takeAndUse();
    expect(await screen.findByText('Step 3 of 5: PAN card')).toBeDefined();
    await takeAndUse();
    expect(await screen.findByText('Step 4 of 5: Aadhaar front')).toBeDefined();
    await takeAndUse(true);
    expect(await screen.findByText('Step 5 of 5: Details')).toBeDefined();
    // Details: the three photos, each with the way to take it again, the typed fields, the consent, then Verify.
    expect(screen.getByRole('img', { name: 'ID check photo of Naina Kapoor' })).toBeDefined();
    expect(screen.getByRole('img', { name: 'PAN card of Naina Kapoor' })).toBeDefined();
    expect(screen.getByRole('img', { name: 'Aadhaar front of Naina Kapoor' })).toBeDefined();
    for (const name of ['Take the photo again', 'Take the PAN card again', 'Take the Aadhaar front again', 'Verify Naina Kapoor']) {
      expect(screen.getByRole('button', { name })).toBeDefined();
    }
    expect(screen.getByRole('switch', { name: 'Naina Kapoor agrees to this ID check' })).toBeDefined();
  });

  it('has no way past a photo step until its photo is kept', async () => {
    renderSection(verified);
    await chooseNaina();
    fireEvent.click(await screen.findByRole('button', { name: 'Start the check' }));
    await screen.findByText('Photo 1 of 3');
    expect(screen.queryByRole('button', { name: 'Next' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Verify Naina Kapoor' })).toBeNull();
  });

  it('goes one step back with Back and keeps what was taken, then forward again with Next', async () => {
    renderSection(verified);
    await chooseNaina();
    fireEvent.click(await screen.findByRole('button', { name: 'Start the check' }));
    await takeAndUse();
    await screen.findByText('Step 3 of 5: PAN card');
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    // The Face step again, with the photo taken, not its camera.
    expect(await screen.findByText('Step 2 of 5: Face')).toBeDefined();
    expect(screen.getByRole('img', { name: 'ID check photo of Naina Kapoor' })).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Take photo' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(await screen.findByText('Step 1 of 5: Member')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Start the check' }));
    expect(screen.getByRole('img', { name: 'ID check photo of Naina Kapoor' })).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(await screen.findByText('Photo 2 of 3')).toBeDefined();
  });

  it('goes back from Details to the Aadhaar front, and keeps what was typed', async () => {
    renderSection(verified);
    await chooseNaina();
    await takeThreePhotos();
    fireEvent.change(screen.getByLabelText('Last four digits of Naina Kapoor\'s Aadhaar'), { target: { value: '1234' } });
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(await screen.findByText('Step 4 of 5: Aadhaar front')).toBeDefined();
    expect(screen.getByRole('img', { name: 'Aadhaar front of Naina Kapoor' })).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByLabelText<HTMLInputElement>('Last four digits of Naina Kapoor\'s Aadhaar').value).toBe('1234');
  });

  it('takes a photo again from Details without losing what was typed, and comes back to Details', async () => {
    renderSection(verified);
    await chooseNaina();
    await takeThreePhotos();
    fireEvent.change(screen.getByLabelText('Last four digits of Naina Kapoor\'s Aadhaar'), { target: { value: '1234' } });
    fireEvent.click(screen.getByRole('button', { name: 'Take the PAN card again' }));
    expect(await screen.findByText('Step 3 of 5: PAN card')).toBeDefined();
    await takeAndUse();
    expect(await screen.findByText('Step 5 of 5: Details')).toBeDefined();
    expect(screen.queryByText(/^Photo \d of 3$/)).toBeNull();
    expect(screen.getByLabelText<HTMLInputElement>('Last four digits of Naina Kapoor\'s Aadhaar').value).toBe('1234');
  });

  it('goes back to the search with Choose another member', async () => {
    renderSection(verified);
    await chooseNaina();
    fireEvent.click(await screen.findByRole('button', { name: 'Choose another member' }));
    expect(screen.getByRole('searchbox', { name: 'Member\'s name or the last digits of their number' })).toBeDefined();
    expect(screen.queryByRole('list', { name: 'ID check in person' })).toBeNull();
  });

  it('tells the desk why when a reopened check also has a photo sent back, on that photo\'s step, and asks for the whole check', async () => {
    renderSection(verified, { ...NAINA, status: 'started', retake_kinds: ['aadhaar_front'], retake_reasons: ['Digits showing'] });
    fireEvent.change(screen.getByRole('searchbox', { name: 'Member\'s name or the last digits of their number' }), { target: { value: 'nai' } });
    expect(await screen.findByText('A photo was sent back. Take it again.')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Check Naina Kapoor' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Start the check' }));
    await takeAndUse();
    await screen.findByText('Step 3 of 5: PAN card');
    expect(screen.queryByText('Sent back: Digits showing.')).toBeNull();
    await takeAndUse();
    await screen.findByText('Step 4 of 5: Aadhaar front');
    expect(screen.getByText('Sent back: Digits showing.')).toBeDefined();
    await takeAndUse(true);
    expect(await screen.findByLabelText('Date of birth on Naina Kapoor\'s original document')).toBeDefined();
  });
});

describe('a check where only photos were sent back (decision 0573, redesign RD-21)', () => {
  const sentBack = { ...NAINA, status: 'verified', retake_kinds: ['pan'], retake_reasons: ['Blurred'] };

  it('opens on the first of them, its camera ready and why above it, and sends that photo alone', async () => {
    const sent = renderSection(() => Response.json({ status: 'retaken' }), sentBack);
    fireEvent.change(screen.getByRole('searchbox', { name: 'Member\'s name or the last digits of their number' }), { target: { value: 'nai' } });
    expect(await screen.findByText('A photo was sent back. Take it again.')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Check Naina Kapoor' }));
    expect(await screen.findByText('Step 3 of 5: PAN card')).toBeDefined();
    expect(screen.getByText('Sent back: Blurred.')).toBeDefined();
    expect(screen.queryByLabelText('Date of birth on Naina Kapoor\'s original document')).toBeNull();
    await takeAndUse();
    expect(await screen.findByText('New photo kept for Naina Kapoor.')).toBeDefined();
    expect(sent).toEqual([{ memberId: NAINA.member_id, kind: 'pan', coversConfirmed: false, image: btoa('jpeg') }]);
  });

  it('opens on the first of two, then moves to the second', async () => {
    const sent = renderSection(() => Response.json({ status: 'retaken' }), { ...sentBack, retake_kinds: ['pan', 'aadhaar_front'], retake_reasons: ['Blurred', 'Digits showing'] });
    await chooseNaina();
    expect(await screen.findByText('Step 3 of 5: PAN card')).toBeDefined();
    await takeAndUse();
    expect(await screen.findByText('Step 4 of 5: Aadhaar front')).toBeDefined();
    expect(screen.getByText('Sent back: Digits showing.')).toBeDefined();
    await takeAndUse(true);
    expect(await screen.findByText('New photo kept for Naina Kapoor.')).toBeDefined();
    expect(sent).toHaveLength(2);
  });

  it('keeps a sent-back photo owed, and says why, when it was not saved', async () => {
    renderSection(() => Response.json({ error: 'decided' }, { status: 409 }), sentBack);
    await chooseNaina();
    await takeAndUse();
    expect((await screen.findByRole('alert')).textContent).toMatch(/^Already decided/);
    expect(screen.getByRole('button', { name: 'Photograph the PAN card' })).toBeDefined();
  });

  it('shows what is owed when its camera is left with Back, and Cancel goes back to the search', async () => {
    renderSection(() => Response.json({ status: 'retaken' }), sentBack);
    await chooseNaina();
    fireEvent.click(await screen.findByRole('button', { name: 'Back' }));
    expect(screen.getByRole('button', { name: 'Photograph the PAN card' })).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.getByRole('searchbox', { name: 'Member\'s name or the last digits of their number' })).toBeDefined();
  });
});
