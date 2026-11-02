import { createRivrClient, RivrDataProvider } from '@rivr/db';
import { QueryClient } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PairScreen } from './PairScreen.tsx';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('pairing the tablet', () => {
  it('asks for six digits when fewer are typed, and sends nothing', async () => {
    const sent: string[] = [];
    vi.stubGlobal('fetch', async (input: RequestInfo | URL) => {
      sent.push(String(input instanceof Request ? input.url : input));
      return Response.json({});
    });
    render(
      <RivrDataProvider client={createRivrClient({ url: 'http://127.0.0.1:9', publishableKey: 'test' })}
        queryClient={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <PairScreen />
      </RivrDataProvider>,
    );
    fireEvent.change(screen.getByRole('textbox', { name: 'Pairing code' }), { target: { value: '12' } });
    fireEvent.click(screen.getByRole('button', { name: 'Pair' }));
    expect(await screen.findByText('Enter all six digits.')).toBeDefined();
    expect(screen.queryByText('Wrong or expired code. Ask for a new one.')).toBeNull();
    expect(sent.filter((url) => url.includes('device-pair'))).toEqual([]);
  });

  it('waits for Pair once six digits are in, as staff read the code out', async () => {
    const sent: string[] = [];
    vi.stubGlobal('fetch', async (input: RequestInfo | URL) => {
      sent.push(String(input instanceof Request ? input.url : input));
      return Response.json({});
    });
    render(
      <RivrDataProvider client={createRivrClient({ url: 'http://127.0.0.1:9', publishableKey: 'test' })}
        queryClient={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <PairScreen />
      </RivrDataProvider>,
    );
    fireEvent.change(screen.getByRole('textbox', { name: 'Pairing code' }), { target: { value: '482913' } });
    await new Promise((settle) => setTimeout(settle, 50));
    expect(sent.filter((url) => url.includes('device-pair'))).toEqual([]);
  });
});
