import { cleanup, fireEvent, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { chooseNaina, NAINA, renderSection, stubCamera, takeThreePhotos } from './inPersonTestApi.tsx';

beforeEach(stubCamera);

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

/**
 * Finds Naina, takes her three photos and fills in every detail from her originals, then verifies; with her consent
 * unless a test leaves it out.
 */
async function checkNaina({ consent = true } = {}) {
  await chooseNaina();
  await takeThreePhotos();
  fireEvent.change(screen.getByLabelText('Date of birth on Naina Kapoor\'s original document'), { target: { value: '1990-04-12' } });
  fireEvent.change(screen.getByLabelText('Last four digits of Naina Kapoor\'s Aadhaar'), { target: { value: '1234' } });
  fireEvent.change(screen.getByLabelText('Naina Kapoor\'s PAN from the original card'), { target: { value: 'abcpn1234d' } });
  if (consent) fireEvent.click(screen.getByRole('switch', { name: 'Naina Kapoor agrees to this ID check' }));
  fireEvent.click(screen.getByRole('button', { name: 'Verify Naina Kapoor' }));
}

describe('a check in person', () => {
  it('sends the photo, the details from the originals and the consent, and says the member is verified', async () => {
    const sent = renderSection(() => Response.json({ status: 'verified' }));
    await checkNaina();
    expect(await screen.findByText('Naina Kapoor is verified and can take a seat.')).toBeDefined();
    expect(sent).toEqual([{
      memberId: NAINA.member_id, dateOfBirth: '1990-04-12', aadhaarLast4: '1234', pan: 'ABCPN1234D', consent: true, coversConfirmed: true,
      image: btoa('jpeg'), panImage: btoa('jpeg'), aadhaarImage: btoa('jpeg'),
    }]);
    expect(screen.queryByRole('button', { name: 'Verify Naina Kapoor' })).toBeNull();
  });

  it('says where the gate sent a check it did not verify', async () => {
    renderSection(() => Response.json({ status: 'refused' }));
    await checkNaina();
    expect(await screen.findByText('Naina Kapoor refused. See the checks below.')).toBeDefined();
    cleanup();
    renderSection(() => Response.json({ status: 'needs_review' }));
    await checkNaina();
    expect(await screen.findByText(/^Naina Kapoor goes to review/)).toBeDefined();
  });

  it('says which member holds the documents when a check is refused as a duplicate (decision 0583)', async () => {
    renderSection(() => Response.json({ status: 'refused' }), NAINA, [], [{ member_number: 25, full_name: 'Arjun Mehta' }]);
    await checkNaina();
    expect(await screen.findByText('These documents are on file for Arjun Mehta, member 25.')).toBeDefined();
    cleanup();
    renderSection(() => Response.json({ status: 'verified' }), NAINA, [], [{ member_number: 25, full_name: 'Arjun Mehta' }]);
    await checkNaina();
    await screen.findByText(/^Naina Kapoor/);
    expect(screen.queryByText(/on file for/)).toBeNull();
  });

  it('keeps the Details step, and says why, when the check did not go through', async () => {
    renderSection(() => Response.json({ error: 'not_allowed' }, { status: 403 }));
    await checkNaina();
    expect((await screen.findByRole('alert')).textContent).toMatch(/^Not allowed: reviewers only/);
    expect(screen.getByRole('button', { name: 'Verify Naina Kapoor' })).toBeDefined();
  });

  it('sends nothing without the member\'s consent, however complete the rest', async () => {
    const sent = renderSection(() => Response.json({ status: 'verified' }));
    await checkNaina({ consent: false });
    expect((await screen.findByRole('alert')).textContent).toMatch(/^All three photos/);
    expect(sent).toEqual([]);
  });

  it('marks a member whose selfie came in for the desk, and shows that selfie on the Member step (decision 0502)', async () => {
    renderSection(() => Response.json({ status: 'verified' }), { ...NAINA, status: 'started', app_selfie_path: `v1/${NAINA.member_id}/photo.jpg` });
    fireEvent.change(screen.getByRole('searchbox', { name: 'Member\'s name or the last digits of their number' }), { target: { value: 'nai' } });
    expect(await screen.findByText('Selfie taken in the app. Check their originals.')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Check Naina Kapoor' }));
    expect(await screen.findByRole('img', { name: 'The selfie Naina Kapoor took in the app' })).toBeDefined();
    expect(screen.getByText('Mobile ending 0203')).toBeDefined();
  });

  it('says a check the app started and never finished, with no selfie for the desk', async () => {
    renderSection(() => Response.json({ status: 'verified' }), { ...NAINA, status: 'started' });
    fireEvent.change(screen.getByRole('searchbox', { name: 'Member\'s name or the last digits of their number' }), { target: { value: 'nai' } });
    expect(await screen.findByText('Started on the app, not finished.')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Check Naina Kapoor' }));
    expect(await screen.findByRole('button', { name: 'Start the check' })).toBeDefined();
    expect(screen.queryByRole('img', { name: 'The selfie Naina Kapoor took in the app' })).toBeNull();
  });

  it('lists who is due tonight before a name is typed, a check held for its PAN among them, and checks one from there (F-010, F-091)', async () => {
    renderSection(() => Response.json({ status: 'verified' }), NAINA, [{ ...NAINA, status: 'needs_pan' }]);
    expect(await screen.findByRole('heading', { name: 'Due tonight' })).toBeDefined();
    expect(await screen.findByText('Waiting for a PAN. Check their originals.')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Check Naina Kapoor' }));
    expect(await screen.findByRole('button', { name: 'Start the check' })).toBeDefined();
  });

  it('says when nobody is due, and leaves the list once a search starts', async () => {
    renderSection(() => Response.json({ status: 'verified' }));
    expect(await screen.findByText('No checks due tonight.')).toBeDefined();
    fireEvent.change(screen.getByRole('searchbox', { name: 'Member\'s name or the last digits of their number' }), { target: { value: 'nai' } });
    expect(await screen.findByText('Mobile ending 0203')).toBeDefined();
    expect(screen.queryByRole('heading', { name: 'Due tonight' })).toBeNull();
  });
});
