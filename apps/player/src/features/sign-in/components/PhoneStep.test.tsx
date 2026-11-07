import { createRivrClient, RivrDataProvider } from '@rivr/db';
import { QueryClient } from '@tanstack/react-query';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PhoneStep } from './PhoneStep.tsx';

afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
});

function renderPhone() {
  render(
    <RivrDataProvider client={createRivrClient({ url: 'http://127.0.0.1:9', publishableKey: 'test' })}
      queryClient={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <PhoneStep onCodeSent={() => undefined} />
    </RivrDataProvider>,
  );
}

describe('Sign in › Phone', () => {
  it('says the code comes on WhatsApp, under the number', () => {
    renderPhone();
    expect(screen.getByRole('textbox', { name: 'Mobile number' }).getAttribute('aria-describedby')).toBeTruthy();
    expect(screen.getByText('Code comes on WhatsApp.')).toBeDefined();
  });

  it('links the terms and the privacy notice on the website, each in a new tab', () => {
    vi.stubEnv('VITE_WEB_URL', 'https://rivr.test');
    renderPhone();
    expect(screen.getByText('Members only, 18+. By continuing you accept the terms and privacy notice.')).toBeDefined();
    const terms = screen.getByRole('link', { name: 'Terms' });
    const privacy = screen.getByRole('link', { name: 'Privacy notice' });
    expect([terms.getAttribute('href'), terms.getAttribute('target')]).toEqual(['https://rivr.test/terms', '_blank']);
    expect([privacy.getAttribute('href'), privacy.getAttribute('target')]).toEqual(['https://rivr.test/privacy', '_blank']);
  });

  it('shows the legal line alone where the build names no website', () => {
    vi.stubEnv('VITE_WEB_URL', '');
    renderPhone();
    expect(screen.getByText('Members only, 18+. By continuing you accept the terms and privacy notice.')).toBeDefined();
    expect(screen.queryByRole('link')).toBeNull();
  });
});
