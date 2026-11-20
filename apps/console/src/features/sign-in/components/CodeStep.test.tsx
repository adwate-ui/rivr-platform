import { indianMobileSchema } from '@rivr/contracts';
import { createRivrClient, RivrDataProvider } from '@rivr/db';
import { QueryClient } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CodeStep } from './CodeStep.tsx';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const PHONE = indianMobileSchema.parse('9000000901');

describe('Sign in › Code', () => {
  it('No answer: says RIVR could not be reached and keeps the code, which Verify sends again', async () => {
    // The first check gets no answer; the second reaches sign-in-verify, which finds no VerifyNow code sent (decision
    // 0679), and Auth refuses the code.
    const sent: unknown[] = [];
    vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
      if (!String(input).includes('/functions/v1/sign-in-verify')) {
        return Response.json({ code: 403, error_code: 'otp_expired', msg: 'Token has expired or is invalid' }, { status: 403 });
      }
      sent.push(JSON.parse(String(init?.body)));
      if (sent.length === 1) throw new TypeError('Load failed');
      return Response.json({ token: null });
    });
    render(
      <RivrDataProvider client={createRivrClient({ url: 'http://127.0.0.1:9', publishableKey: 'test' })}
        queryClient={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <CodeStep phone={PHONE} onBack={() => undefined} onSignedIn={() => undefined} />
      </RivrDataProvider>,
    );
    const field = screen.getByRole('textbox', { name: 'Code sent to +91 90000 00901' });
    fireEvent.change(field, { target: { value: '123456' } });
    expect(await screen.findByText('Could not reach RIVR. Check your connection and try again.')).toBeDefined();
    expect(field).toHaveProperty('value', '123456');

    fireEvent.click(screen.getByRole('button', { name: 'Verify' }));
    // Any other refusal empties the cells, as before.
    expect(await screen.findByText('Wrong or expired code. Check it or send a new one.')).toBeDefined();
    expect(field).toHaveProperty('value', '');
    expect(sent).toEqual([{ phone: PHONE, code: '123456' }, { phone: PHONE, code: '123456' }]);
  });
});
