import { createRivrClient, RivrDataProvider } from '@rivr/db';
import { QueryClient } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AddMemberForm } from './AddMemberForm.tsx';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('adding a member to a list by number', () => {
  it('stops an empty number at the field, before any call', async () => {
    const sent: string[] = [];
    vi.stubGlobal('fetch', async (input: RequestInfo | URL) => {
      sent.push(String(input instanceof Request ? input.url : input));
      return Response.json([]);
    });
    render(
      <RivrDataProvider client={createRivrClient({ url: 'http://127.0.0.1:9', publishableKey: 'test' })}
        queryClient={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <AddMemberForm venueId="v1" tableTypeId="t1" />
      </RivrDataProvider>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Add to the list' }));
    expect(await screen.findByText('Enter a 10-digit mobile number.')).toBeDefined();
    expect(sent.filter((url) => url.includes('add_to_waitlist'))).toEqual([]);
  });
});
