import { createRivrClient, RivrDataProvider } from '@rivr/db';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ReviewForm } from './ReviewForm.tsx';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('a review that needs the date of birth', () => {
  it('says under the field that a year typed in two digits will not do, and sends nothing', async () => {
    const asked: string[] = [];
    vi.stubGlobal('fetch', async (input: RequestInfo | URL) => {
      asked.push(String(input instanceof Request ? input.url : input));
      return Response.json([]);
    });
    render(
      <RivrDataProvider client={createRivrClient({ url: 'http://127.0.0.1:9', publishableKey: 'test' })}>
        <ReviewForm venueId="v1" memberId="00000000-0000-4000-8000-000000000203" fullName="Naina Kapoor" needsDateOfBirth needsPan={false} onDecided={() => undefined} />
      </RivrDataProvider>,
    );
    fireEvent.change(screen.getByLabelText('Date of birth on Naina Kapoor\'s original document'), { target: { value: '0092-04-12' } });
    fireEvent.change(screen.getByLabelText(/^Reason/), { target: { value: 'Seen the original card' } });
    fireEvent.click(screen.getByRole('button', { name: /^Approve/ }));
    expect(await screen.findByText('Give the date of birth on the document, with a 4-digit year.')).toBeDefined();
    // One error for the date, under its field: the message for the reason and the PAN stays away (the UI review, 20 Nov).
    expect(screen.queryByText('Check the reason (3 to 500 characters, no document numbers) and the PAN.')).toBeNull();
    expect(screen.getAllByRole('alert')).toHaveLength(1);
    expect(asked.filter((url) => url.includes('/rpc/review_kyc'))).toEqual([]);
  });

  it('says to check the reason and the PAN when the reason will not do, and sends nothing', async () => {
    const asked: string[] = [];
    vi.stubGlobal('fetch', async (input: RequestInfo | URL) => {
      asked.push(String(input instanceof Request ? input.url : input));
      return Response.json([]);
    });
    render(
      <RivrDataProvider client={createRivrClient({ url: 'http://127.0.0.1:9', publishableKey: 'test' })}>
        <ReviewForm venueId="v1" memberId="00000000-0000-4000-8000-000000000203" fullName="Naina Kapoor" needsDateOfBirth needsPan={false} onDecided={() => undefined} />
      </RivrDataProvider>,
    );
    fireEvent.change(screen.getByLabelText('Date of birth on Naina Kapoor\'s original document'), { target: { value: '1992-04-12' } });
    fireEvent.change(screen.getByLabelText(/^Reason/), { target: { value: 'ok' } });
    fireEvent.click(screen.getByRole('button', { name: /^Approve/ }));
    expect(await screen.findByText('Check the reason (3 to 500 characters, no document numbers) and the PAN.')).toBeDefined();
    expect(screen.queryByText('Give the date of birth on the document, with a 4-digit year.')).toBeNull();
    expect(asked.filter((url) => url.includes('/rpc/review_kyc'))).toEqual([]);
  });
});
