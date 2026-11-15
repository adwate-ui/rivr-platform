import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { chooseNaina, NAINA, renderSection, renderSheet, stubCamera, takeAndUse, takeThreePhotos, typeDetails } from './inPersonTestApi.tsx';

beforeEach(stubCamera);

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const verified = () => Response.json({ status: 'verified' });
const step = (name: string) => screen.findByRole('heading', { name, level: 3 });
/** The step that is open: its heading has the focus, since the button that led here is gone. */
const expectOpen = async (position: string, name: string) => {
  expect(await screen.findByText(position)).toBeDefined();
  await waitFor(async () => expect(document.activeElement).toBe(await step(name)));
};
const isOff = (name: string) => screen.getByRole('button', { name }).hasAttribute('disabled');

describe('the check in person as five steps (redesign RD-21)', () => {
  it('goes Member, Face, PAN card, Aadhaar front, Details under the progress bar, "Use photo" moving on, each step taking the focus', async () => {
    renderSection(verified);
    await chooseNaina();
    await expectOpen('Step 1 of 5: Member', 'Member');
    expect(screen.getByRole('list', { name: 'ID check in person' })).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Start the check' }));
    await expectOpen('Step 2 of 5: Face', 'Face');
    await takeAndUse();
    await expectOpen('Step 3 of 5: PAN card', 'PAN card');
    await takeAndUse();
    await expectOpen('Step 4 of 5: Aadhaar front', 'Aadhaar front');
    await takeAndUse(true);
    await expectOpen('Step 5 of 5: Details', 'Details');
    // Details: the three photos, each with the way to take it again, the typed fields, the consent, then Verify.
    for (const name of ['ID check photo of Naina Kapoor', 'PAN card of Naina Kapoor', 'Aadhaar front of Naina Kapoor']) expect(screen.getByRole('img', { name })).toBeDefined();
    for (const name of ['Take the photo again', 'Take the PAN card again', 'Take the Aadhaar front again', 'Verify Naina Kapoor']) expect(screen.getByRole('button', { name })).toBeDefined();
    expect(screen.getByRole('switch', { name: 'Naina Kapoor agrees to this ID check' })).toBeDefined();
    // One word on every button that takes a photo again; what is taken again is read out.
    for (const name of ['Take the photo again', 'Take the PAN card again', 'Take the Aadhaar front again']) expect(screen.getByRole('button', { name }).textContent).toBe('Retake');
  });

  it('has no way past any photo step until its photo is kept', async () => {
    renderSection(verified);
    await chooseNaina();
    fireEvent.click(await screen.findByRole('button', { name: 'Start the check' }));
    for (const [position, confirmBars] of [['Photo 1 of 3', false], ['Photo 2 of 3', false], ['Photo 3 of 3', true]] as const) {
      await screen.findByText(position);
      expect(screen.queryByRole('button', { name: 'Next' })).toBeNull();
      expect(screen.queryByRole('button', { name: 'Verify Naina Kapoor' })).toBeNull();
      await takeAndUse(confirmBars);
    }
    expect(await screen.findByRole('button', { name: 'Verify Naina Kapoor' })).toBeDefined();
  });

  it('goes one step back with Back and keeps what was taken, then forward again with Next', async () => {
    renderSection(verified);
    await chooseNaina();
    fireEvent.click(await screen.findByRole('button', { name: 'Start the check' }));
    await takeAndUse();
    await screen.findByText('Step 3 of 5: PAN card');
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    // The Face step again, with the photo taken, not its camera.
    await expectOpen('Step 2 of 5: Face', 'Face');
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

  it('takes a photo again from Details and comes back to Details, by Use photo or by Back, without losing what was typed', async () => {
    renderSection(verified);
    await chooseNaina();
    await takeThreePhotos();
    fireEvent.change(screen.getByLabelText('Last four digits of Naina Kapoor\'s Aadhaar'), { target: { value: '1234' } });
    fireEvent.click(screen.getByRole('button', { name: 'Take the PAN card again' }));
    await expectOpen('Step 3 of 5: PAN card', 'PAN card');
    await takeAndUse();
    await expectOpen('Step 5 of 5: Details', 'Details');
    expect(screen.queryByText(/^Photo \d of 3$/)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Take the photo again' }));
    await screen.findByText('Step 2 of 5: Face');
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    await expectOpen('Step 5 of 5: Details', 'Details');
    expect(screen.getByLabelText<HTMLInputElement>('Last four digits of Naina Kapoor\'s Aadhaar').value).toBe('1234');
  });

  it('says a photo was not received beside its camera, under "Photo 1 of 3", and takes it again', async () => {
    renderSection(verified);
    await chooseNaina();
    fireEvent.click(await screen.findByRole('button', { name: 'Start the check' }));
    vi.stubGlobal('createImageBitmap', async () => { throw new Error('unreadable'); });
    await takeAndUse();
    const problem = await screen.findByText('Photo not received. Take it again.');
    expect(screen.getByText('Photo 1 of 3').compareDocumentPosition(problem) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(problem.compareDocumentPosition(await screen.findByRole('button', { name: 'Take photo' })) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByText('Step 2 of 5: Face')).toBeDefined();
  });

  it('says under each field and under the consent what is wrong, sends nothing, and clears the server\'s refusal when anything is edited', async () => {
    const reply = vi.fn(() => Response.json({ error: 'not_allowed' }, { status: 403 }));
    const sent = renderSection(reply);
    await chooseNaina();
    await takeThreePhotos();
    fireEvent.click(screen.getByRole('button', { name: 'Verify Naina Kapoor' }));
    expect(await screen.findByText('Give the date of birth on the document.')).toBeDefined();
    expect(screen.getByText('Give the last four digits.')).toBeDefined();
    expect(screen.getByText('Give the PAN as on the card.')).toBeDefined();
    expect(screen.getByText('Ask for their consent, then switch this on.')).toBeDefined();
    expect(sent).toEqual([]);
    typeDetails();
    fireEvent.click(screen.getByRole('switch', { name: 'Naina Kapoor agrees to this ID check' }));
    expect(screen.queryByText('Ask for their consent, then switch this on.')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Verify Naina Kapoor' }));
    expect(await screen.findByText(/^Not allowed: reviewers only/)).toBeDefined();
    expect(screen.queryByText('Give the PAN as on the card.')).toBeNull();
    fireEvent.change(screen.getByLabelText('Last four digits of Naina Kapoor\'s Aadhaar'), { target: { value: '4321' } });
    expect(screen.queryByText(/^Not allowed: reviewers only/)).toBeNull();
  });

  it('sends the check once however often Verify is pressed, and while it is saved nothing on Details leads away', async () => {
    let answer: (response: Response) => void = () => undefined;
    const sent = renderSection(() => new Promise<Response>((resolve) => { answer = resolve; }));
    await chooseNaina();
    await takeThreePhotos();
    typeDetails();
    fireEvent.click(screen.getByRole('switch', { name: 'Naina Kapoor agrees to this ID check' }));
    fireEvent.click(screen.getByRole('button', { name: 'Verify Naina Kapoor' }));
    fireEvent.click(screen.getByRole('button', { name: 'Verify Naina Kapoor' }));
    await waitFor(() => expect(sent).toHaveLength(1));
    expect(['Take the photo again', 'Take the PAN card again', 'Take the Aadhaar front again', 'Back'].map(isOff)).toEqual([true, true, true, true]);
    answer(Response.json({ status: 'verified' }));
    expect(await screen.findByText('Naina Kapoor is verified and can take a seat.')).toBeDefined();
    expect(sent).toHaveLength(1);
  });

  it('tells the desk why when a reopened check also has a photo sent back, on that photo\'s step and on Details, and asks for the whole check', async () => {
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
    expect(screen.getByText('Sent back: Digits showing.')).toBeDefined();
  });
});

describe('a check started again has nothing of the one before', () => {
  /** A check with every photo, every detail and the consent, left on Details. */
  async function fillCheck() {
    await chooseNaina();
    await takeThreePhotos();
    typeDetails();
    fireEvent.click(screen.getByRole('switch', { name: 'Naina Kapoor agrees to this ID check' }));
  }
  /** The check from its start again: no photo on any step, nothing typed, the consent off. */
  async function expectEmptyCheck() {
    await chooseNaina();
    fireEvent.click(await screen.findByRole('button', { name: 'Start the check' }));
    expect(await screen.findByRole('button', { name: 'Take photo' })).toBeDefined();
    expect(screen.queryByRole('img', { name: 'ID check photo of Naina Kapoor' })).toBeNull();
    await takeAndUse();
    await screen.findByText('Photo 2 of 3');
    expect(screen.queryByRole('button', { name: 'Next' })).toBeNull();
    await takeAndUse();
    await takeAndUse(true);
    await screen.findByRole('button', { name: 'Verify Naina Kapoor' });
    expect(screen.getByLabelText<HTMLInputElement>('Date of birth on Naina Kapoor\'s original document').value).toBe('');
    expect(screen.getByLabelText<HTMLInputElement>('Last four digits of Naina Kapoor\'s Aadhaar').value).toBe('');
    expect(screen.getByLabelText<HTMLInputElement>('Naina Kapoor\'s PAN from the original card').value).toBe('');
    expect(screen.getByRole('switch', { name: 'Naina Kapoor agrees to this ID check' }).getAttribute('aria-checked')).toBe('false');
  }

  it('after Choose another member', async () => {
    renderSection(verified);
    await fillCheck();
    for (const position of ['Step 4 of 5: Aadhaar front', 'Step 3 of 5: PAN card', 'Step 2 of 5: Face', 'Step 1 of 5: Member']) {
      fireEvent.click(screen.getByRole('button', { name: 'Back' }));
      await screen.findByText(position);
    }
    fireEvent.click(screen.getByRole('button', { name: 'Choose another member' }));
    expect(screen.queryByRole('list', { name: 'ID check in person' })).toBeNull();
    await expectEmptyCheck();
  });

  it('after the sheet is closed and opened again', async () => {
    renderSheet(verified);
    fireEvent.click(screen.getByRole('button', { name: 'ID check in person' }));
    await fillCheck();
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    fireEvent.click(screen.getByRole('button', { name: 'ID check in person' }));
    await screen.findByRole('dialog', { name: 'ID check in person' });
    await expectEmptyCheck();
  });
});
