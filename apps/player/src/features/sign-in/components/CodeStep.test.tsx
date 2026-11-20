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

function renderCode(checkCode: () => Promise<Response> = async () => Response.json({ token: null })) {
  // sign-in-verify answers with `checkCode`, by default that VerifyNow sent no code (decision 0679), and Auth refuses every
  // code as expired or wrong.
  vi.stubGlobal('fetch', async (input: RequestInfo | URL) => (String(input).includes('/functions/v1/sign-in-verify')
    ? checkCode()
    : Response.json({ code: 403, error_code: 'otp_expired', msg: 'Token has expired or is invalid' }, { status: 403 })));
  const onBack = vi.fn();
  render(
    <RivrDataProvider client={createRivrClient({ url: 'http://127.0.0.1:9', publishableKey: 'test' })}
      queryClient={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <CodeStep phone={PHONE} onBack={onBack} onSignedIn={() => undefined} />
    </RivrDataProvider>,
  );
  return onBack;
}

describe('Sign in › Code', () => {
  it('says so when the phone has no connection, and holds the code and a new one back (F-175)', () => {
    Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => false });
    try {
      renderCode();
      expect(screen.getByText('No connection. Enter the code once back online.')).toBeDefined();
      expect(screen.getByRole('button', { name: 'Verify' })).toHaveProperty('disabled', true);
    } finally {
      Reflect.deleteProperty(navigator, 'onLine');
    }
  });

  it('says the code went by SMS to the number, with six cells and the resend counting down', () => {
    renderCode();
    expect(screen.getByRole('heading', { name: 'Enter the code' })).toBeDefined();
    expect(screen.getByText('Sent by SMS to +91 90000 00901')).toBeDefined();
    const field = screen.getByRole('textbox', { name: '6-digit code' });
    expect(field.getAttribute('autocomplete')).toBe('one-time-code');
    expect(field.getAttribute('inputmode')).toBe('numeric');
    expect(screen.getByRole('button', { name: /^Resend code in 1:00$/ })).toHaveProperty('disabled', true);
  });

  it('Wrong code: says it did not match and empties the cells', async () => {
    renderCode();
    const field = screen.getByRole('textbox', { name: '6-digit code' });
    fireEvent.change(field, { target: { value: '000000' } });
    expect(await screen.findByText('Wrong or expired code. Check it, or resend.')).toBeDefined();
    expect(field).toHaveProperty('value', '');
  });

  it('No answer: says the club could not be reached and keeps the code, to verify again', async () => {
    renderCode(() => Promise.reject(new TypeError('Load failed')));
    const field = screen.getByRole('textbox', { name: '6-digit code' });
    fireEvent.change(field, { target: { value: '123456' } });
    expect(await screen.findByText('Could not reach RIVR. Check your connection and try again.')).toBeDefined();
    expect(field).toHaveProperty('value', '123456');
    expect(screen.getByRole('button', { name: 'Verify' })).toHaveProperty('disabled', false);
  });

  it('goes back to the number', () => {
    const onBack = renderCode();
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(onBack).toHaveBeenCalledOnce();
  });
});
